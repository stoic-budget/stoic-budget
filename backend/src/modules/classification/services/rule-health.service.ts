import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThanOrEqual, type Repository } from 'typeorm';
import { flowsSql } from '../../../common/utils/counted-transactions.util';
import { canReadPrivate } from '../../../common/utils/transaction-privacy.util';
import { CategorizationRule } from '../../../entities/categorization-rule.entity';
import { Transaction, TransactionCategorySource } from '../../../entities/transaction.entity';
import { ViewPreference } from '../../../entities/view-preference.entity';
import { decides, matchingRules } from '../engine/rule-layers';
import { ownsRuleRefs } from '../engine/rule-refs';
import { RuleSuggestionsService } from './rule-suggestions.service';

/** Hand corrections against one rule before they say something about it. */
const CONTRADICTION_MIN = 3;
const CONTRADICTION_WINDOW_DAYS = 90;
const CONTRADICTION_ROWS_READ = 2000;
/** How long a rule may wait for its first match, and go without another. */
const NEVER_MATCHED_DAYS = 30;
const DORMANT_DAYS = 180;
/** A rule is idle only while rows keep arriving: nothing imported tells nothing. */
const IDLE_RECENT_DAYS = 30;
const IDLE_RECENT_ROWS = 20;

const DAY_MS = 86_400_000;

export interface RuleHealth {
  /** Active rules naming a category, account or payee that is gone: they silently do nothing. */
  broken: Array<{ id: string; name: string }>;
  /** Active rules the person keeps overruling by hand, most overruled first. */
  contradicted: Array<{ id: string; name: string; count: number }>;
  /** A decision made by hand again and again, not yet a rule. */
  worthWriting: { count: number; payee: string; decided: number } | null;
  /** Active rules nothing has met for a long time, longest first. */
  idle: Array<{ id: string; name: string; months: number }>;
  /** Rows of the month, and those filed by a rule. */
  filed: { byRule: number; total: number };
}

/** Whether the rules of a workspace still do what they were written for. */
@Injectable()
export class RuleHealthService {
  constructor(
    @InjectRepository(CategorizationRule)
    private readonly ruleRepository: Repository<CategorizationRule>,
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    @InjectRepository(ViewPreference)
    private readonly preferenceRepository: Repository<ViewPreference>,
    private readonly ruleSuggestionsService: RuleSuggestionsService,
  ) {}

  async load(
    workspaceId: string,
    userId: string,
    month: { start: Date; end: Date },
    now = new Date(),
  ): Promise<RuleHealth> {
    const rules = await this.ruleRepository.find({
      where: { workspaceId, isActive: true },
      order: { priority: 'DESC' },
    });
    const brokenRules = await this.brokenRules(workspaceId, rules);
    const brokenIds = new Set(brokenRules.map(rule => rule.id));
    const working = rules.filter(rule => !brokenIds.has(rule.id));

    const [contradicted, worthWriting, idle, filed] = await Promise.all([
      this.contradictedRules(workspaceId, working, now),
      this.worthWriting(workspaceId, userId),
      this.idleRules(workspaceId, working, now),
      this.filedInMonth(workspaceId, month),
    ]);
    return {
      broken: brokenRules.map(({ id, name }) => ({ id, name })),
      contradicted,
      worthWriting,
      idle,
      filed,
    };
  }

  private async brokenRules(workspaceId: string, rules: CategorizationRule[]) {
    const owned = await Promise.all(
      rules.map(rule => ownsRuleRefs(this.ruleRepository.manager, workspaceId, rule.result)),
    );
    return rules.filter((_, index) => !owned[index]);
  }

  /**
   * Rows a person filed by hand against the rule that would file them: only rows
   * that arrived after the rule, since the rule never had a say over older ones.
   * Advice is the workspace's, so nobody's private rows feed it.
   */
  private async contradictedRules(
    workspaceId: string,
    rules: CategorizationRule[],
    now: Date,
  ): Promise<RuleHealth['contradicted']> {
    const categoryRules = rules.filter(rule => decides(rule.result, 'categoryId'));
    if (categoryRules.length === 0) {
      return [];
    }
    const rows = await this.transactionRepository
      .createQueryBuilder('t')
      .where('t.workspaceId = :workspaceId', { workspaceId })
      .andWhere('t.categorySource = :manual', { manual: TransactionCategorySource.MANUAL })
      .andWhere('t.categoryId IS NOT NULL')
      .andWhere('t.isDuplicate = false')
      .andWhere('t.splitGroupId IS NULL')
      .andWhere('t.transactionDate >= :since', {
        since: new Date(now.getTime() - CONTRADICTION_WINDOW_DAYS * DAY_MS),
      })
      .orderBy('t.transactionDate', 'DESC')
      .take(CONTRADICTION_ROWS_READ)
      .getMany();

    const counts = new Map<string, number>();
    for (const row of rows) {
      const winner = matchingRules(categoryRules, row)[0];
      if (
        winner &&
        canReadPrivate(row, null) &&
        row.createdAt >= winner.createdAt &&
        winner.result.categoryId !== row.categoryId
      ) {
        counts.set(winner.id, (counts.get(winner.id) ?? 0) + 1);
      }
    }
    return categoryRules
      .map(rule => ({ id: rule.id, name: rule.name, count: counts.get(rule.id) ?? 0 }))
      .filter(rule => rule.count >= CONTRADICTION_MIN)
      .sort((a, b) => b.count - a.count);
  }

  /** The same suggestions the Rules page shows, less the ones this person waved away. */
  private async worthWriting(
    workspaceId: string,
    userId: string,
  ): Promise<RuleHealth['worthWriting']> {
    const [suggestions, preference] = await Promise.all([
      this.ruleSuggestionsService.suggest(workspaceId, null),
      this.preferenceRepository.findOne({
        where: { userId, workspaceId, scope: 'rules' },
        select: { state: true },
      }),
    ]);
    const dismissed = preference?.state.dismissedSuggestions;
    const waved = new Set(Array.isArray(dismissed) ? dismissed : []);
    const open = suggestions.filter(item => !waved.has(item.payeeId));
    const [top] = open;
    return top ? { count: open.length, payee: top.payeeName, decided: top.decidedCount } : null;
  }

  private async idleRules(
    workspaceId: string,
    rules: CategorizationRule[],
    now: Date,
  ): Promise<RuleHealth['idle']> {
    const ageInDays = (date: Date) => (now.getTime() - date.getTime()) / DAY_MS;
    const quiet = rules.filter(rule =>
      rule.lastMatchedAt
        ? ageInDays(rule.lastMatchedAt) >= DORMANT_DAYS
        : ageInDays(rule.createdAt) >= NEVER_MATCHED_DAYS,
    );
    if (quiet.length === 0) {
      return [];
    }
    const recentRows = await this.transactionRepository.count({
      where: {
        workspaceId,
        createdAt: MoreThanOrEqual(new Date(now.getTime() - IDLE_RECENT_DAYS * DAY_MS)),
      },
    });
    if (recentRows < IDLE_RECENT_ROWS) {
      return [];
    }
    return quiet
      .map(rule => ({
        id: rule.id,
        name: rule.name,
        months: Math.floor(ageInDays(rule.lastMatchedAt ?? rule.createdAt) / 30),
      }))
      .sort((a, b) => b.months - a.months);
  }

  private async filedInMonth(
    workspaceId: string,
    month: { start: Date; end: Date },
  ): Promise<RuleHealth['filed']> {
    const row = await this.transactionRepository
      .createQueryBuilder('t')
      .select('COUNT(*)', 'total')
      .addSelect('COUNT(*) FILTER (WHERE t.category_source = :rule)', 'byRule')
      .where('t.workspace_id = :workspaceId', { workspaceId })
      .andWhere('t.transfer_pair_id IS NULL')
      .andWhere(flowsSql('t'))
      .andWhere('t.transaction_date >= :start', { start: month.start })
      .andWhere('t.transaction_date <= :end', { end: month.end })
      .setParameter('rule', TransactionCategorySource.RULE)
      .getRawOne<{ total: string; byRule: string }>();
    return {
      byRule: Number.parseInt(row?.byRule ?? '0', 10) || 0,
      total: Number.parseInt(row?.total ?? '0', 10) || 0,
    };
  }
}
