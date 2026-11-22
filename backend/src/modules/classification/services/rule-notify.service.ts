import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { In, type Repository } from 'typeorm';
import { Transaction } from '../../../entities/transaction.entity';
import type {
  ImportCommittedEvent,
  RuleMatchedEvent,
  TransactionCreatedEvent,
  TransactionsImportedEvent,
} from '../../notifications/events/notification-events';
import { conditionsUse } from '../engine/rule-condition-tree';
import { type RuleNotifyMatch, ruleNotifyMatches } from '../engine/rule-notify';
import { ownsRuleRefs } from '../engine/rule-refs';
import { rowTagIds } from '../engine/rule-tags';
import { ClassificationService } from './classification.service';

/** How many new rows are read at a time. */
const PAGE = 500;
/** A rule's name in a notification title, which holds 255 characters with the words around it. */
const NAME_LENGTH = 120;
/**
 * How many rows of one import a rule tells each recipient about one by one.
 * The rest come as one more notification with their count, so a year's
 * statement does not send a message per row.
 */
export const ROWS_TOLD_ONE_BY_ONE = 3;

/**
 * Tells people about new rows that match a rule asking for it: rows a
 * statement import or a bank sync booked, rows imported in bulk, a row typed
 * in. Each rule and row is claimed once in `rule_notify_marks` before anything
 * is sent, so a row imported again never notifies twice. Applying a rule to
 * old rows does not come through here and tells nobody. Past
 * `ROWS_TOLD_ONE_BY_ONE` rows of one import, a rule's recipient gets a count.
 */
@Injectable()
export class RuleNotifyService {
  private readonly logger = new Logger(RuleNotifyService.name);

  constructor(
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    private readonly classificationService: ClassificationService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @OnEvent('import.committed')
  async onImportCommitted(event: ImportCommittedEvent): Promise<void> {
    await this.safely(event.workspaceId, event.transactionIds ?? []);
  }

  @OnEvent('transactions.imported')
  async onTransactionsImported(event: TransactionsImportedEvent): Promise<void> {
    await this.safely(event.workspaceId, event.transactionIds);
  }

  @OnEvent('transaction.created')
  async onTransactionCreated(event: TransactionCreatedEvent): Promise<void> {
    await this.safely(event.workspaceId, [event.transactionId]);
  }

  /** @returns how many notifications were asked for: one per rule and row, up to the limit, plus the counts. */
  async notifyNewRows(workspaceId: string, transactionIds: readonly string[]): Promise<number> {
    if (transactionIds.length === 0) {
      return 0;
    }
    const rules = await this.applicableRules(workspaceId);
    if (!rules.some(rule => rule.result.notify)) {
      return 0;
    }
    let sent = 0;
    const told = new Map<string, number>();
    const rest = new Map<string, { match: RuleNotifyMatch; count: number }>();
    for (let offset = 0; offset < transactionIds.length; offset += PAGE) {
      const ids = transactionIds.slice(offset, offset + PAGE);
      // Duplicates are the same purchase again: never news.
      const rows = await this.transactionRepository.find({
        where: { workspaceId, id: In([...ids]), isDuplicate: false },
        relations: { wallet: true, payee: true },
      });
      const tagIds = conditionsUse(rules, 'tags')
        ? await rowTagIds(
            this.transactionRepository.manager,
            workspaceId,
            rows.map(row => row.id),
          )
        : undefined;
      const claimed = await this.claim(workspaceId, ruleNotifyMatches(rows, rules, tagIds));
      // One at a time: a burst for one person would race on their preferences row.
      for (const match of claimed) {
        const recipient = `${match.rule.id}|${match.memberId ?? 'everyone'}`;
        const count = told.get(recipient) ?? 0;
        if (count < ROWS_TOLD_ONE_BY_ONE) {
          told.set(recipient, count + 1);
          await this.eventEmitter.emitAsync('rule.matched', this.eventOf(workspaceId, match));
          sent += 1;
        } else {
          const more = rest.get(recipient);
          if (more) more.count += 1;
          else rest.set(recipient, { match, count: 1 });
        }
      }
    }
    for (const { match, count } of rest.values()) {
      await this.eventEmitter.emitAsync('rule.matched', {
        ...this.eventOf(workspaceId, match),
        more: count,
      });
      sent += 1;
    }
    return sent;
  }

  private async safely(workspaceId: string, transactionIds: readonly string[]): Promise<void> {
    try {
      await this.notifyNewRows(workspaceId, transactionIds);
    } catch (error) {
      this.logger.error(
        `Rule notifications failed for workspace ${workspaceId}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  /** The active rules, best first, that name only what is this workspace's (as on import). */
  private async applicableRules(workspaceId: string) {
    const rules = await this.classificationService.getClassificationRules(workspaceId);
    if (!rules.some(rule => rule.result.notify)) {
      return [];
    }
    const manager = this.transactionRepository.manager;
    const owned = await Promise.all(
      rules.map(rule => ownsRuleRefs(manager, workspaceId, rule.result)),
    );
    return rules.filter((_, index) => owned[index]);
  }

  /** The matches nobody was told about yet, now marked as told. */
  private async claim(workspaceId: string, matches: RuleNotifyMatch[]): Promise<RuleNotifyMatch[]> {
    if (matches.length === 0) {
      return [];
    }
    const won: Array<{ rule_id: string; row_key: string }> = await this.transactionRepository.query(
      `INSERT INTO rule_notify_marks (rule_id, row_key, workspace_id)
       SELECT pair.rule_id, pair.row_key, $3
         FROM unnest($1::uuid[], $2::text[]) AS pair(rule_id, row_key)
         JOIN categorization_rules rule ON rule.id = pair.rule_id AND rule.workspace_id = $3
       ON CONFLICT DO NOTHING
       RETURNING rule_id, row_key`,
      [matches.map(match => match.rule.id), matches.map(match => match.key), workspaceId],
    );
    const fresh = new Set(won.map(mark => `${mark.rule_id}|${mark.row_key}`));
    // One notification per rule and key, even when two rows of the batch share one.
    return matches.filter(match => fresh.delete(`${match.rule.id}|${match.key}`));
  }

  private eventOf(workspaceId: string, { row, rule, memberId }: RuleNotifyMatch): RuleMatchedEvent {
    const name = rule.name.length > NAME_LENGTH ? `${rule.name.slice(0, NAME_LENGTH)}…` : rule.name;
    return {
      workspaceId,
      ruleId: rule.id ?? '',
      ruleName: name,
      memberId,
      transactionId: row.id,
      statementId: row.statementId ?? null,
      payee: row.payee?.name || row.counterpartyName,
      amount: Number(row.debit || row.credit || row.amount || 0),
      currency: row.currency,
      account: row.wallet?.name ?? null,
    };
  }
}
