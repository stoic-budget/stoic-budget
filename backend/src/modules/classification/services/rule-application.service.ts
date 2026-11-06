import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Cache } from 'cache-manager';
import { In, type Repository } from 'typeorm';
import { canReadPrivate } from '../../../common/utils/transaction-privacy.util';
import { CategorizationRule } from '../../../entities/categorization-rule.entity';
import { Transaction, TransactionCategorySource } from '../../../entities/transaction.entity';
import { AuditService } from '../../audit/audit.service';
import { TaxAssignmentService } from '../../tax/tax-assignment.service';
import { hasDecidedCategory } from '../engine/category-decision';
import { movesToWallet, planRuleApply } from '../engine/rule-apply-plan';
import { explainMatch, matchesRule } from '../engine/rule-conditions';
import { ownsRuleRefs } from '../engine/rule-refs';
import { addTransactionTags, ownedTagIds } from '../engine/rule-tags';
import { ruleApplyEvents } from '../helpers/rule-audit';
import type {
  ClassificationCondition,
  MatchMode,
} from '../interfaces/classification-rule.interface';
import { ClassificationService } from './classification.service';

/** How many of a workspace's most recent rows a rule preview looks at. */
const RULE_SCAN_LIMIT = 5000;
/** What an apply did, by the kind of change. */
type RuleApplyTotals = Record<
  'applied' | 'skippedManual' | 'tagged' | 'moved' | 'commented' | 'renamed',
  number
>;

/** How many rows an apply reads and writes at a time. */
const RULE_APPLY_PAGE = 1000;
/** How many matching rows the preview hands back as examples. */
const RULE_PREVIEW_MATCHES = 50;

/** What the rules page does with a rule before and after it is saved: preview it, apply it. */
@Injectable()
export class RuleApplicationService {
  constructor(
    @InjectRepository(Transaction)
    private transactionRepository: Repository<Transaction>,
    private readonly classificationService: ClassificationService,
    private readonly auditService: AuditService,
    private readonly taxAssignmentService: TaxAssignmentService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  /**
   * The workspace's rows a rule is tried on: not duplicates, not split parts,
   * not in a trashed statement.
   */
  private rowsQuery(workspaceId: string) {
    return this.transactionRepository
      .createQueryBuilder('transaction')
      .where('transaction.workspaceId = :workspaceId', { workspaceId })
      .andWhere('transaction.isDuplicate = false')
      .andWhere('transaction.splitGroupId IS NULL')
      .andWhere(
        'NOT EXISTS (SELECT 1 FROM statements trashed WHERE trashed.id = transaction.statementId AND trashed.deleted_at IS NOT NULL)',
      );
  }

  /** The newest of those rows for the preview, up to the scan limit. */
  private async rowsForRule(
    workspaceId: string,
    transactionIds?: readonly string[],
  ): Promise<{ rows: Transaction[]; truncated: boolean }> {
    const query = this.rowsQuery(workspaceId)
      .orderBy('transaction.transactionDate', 'DESC')
      .addOrderBy('transaction.id', 'DESC')
      .take(RULE_SCAN_LIMIT + 1);
    if (transactionIds) {
      query.andWhere('transaction.id IN (:...transactionIds)', { transactionIds });
    }
    // One row more than the limit tells a full page from a truncated one.
    const rows = await query.getMany();
    return { rows: rows.slice(0, RULE_SCAN_LIMIT), truncated: rows.length > RULE_SCAN_LIMIT };
  }

  /** Every one of those rows for an apply, a page at a time in id order. */
  private async *pagesForRule(workspaceId: string): AsyncGenerator<Transaction[]> {
    let after: string | null = null;
    for (;;) {
      const query = this.rowsQuery(workspaceId)
        .orderBy('transaction.id', 'ASC')
        .take(RULE_APPLY_PAGE);
      if (after) {
        query.andWhere('transaction.id > :after', { after });
      }
      const rows = await query.getMany();
      if (rows.length > 0) {
        yield rows;
      }
      if (rows.length < RULE_APPLY_PAGE) {
        return;
      }
      after = rows[rows.length - 1].id;
    }
  }

  /**
   * The active rules tried before `ruleId`, best first. A rule not saved yet
   * goes on top, so nothing is tried before it.
   */
  private async rulesAbove(workspaceId: string, ruleId?: string): Promise<CategorizationRule[]> {
    if (!ruleId) {
      return [];
    }
    const rules = await this.transactionRepository.manager.getRepository(CategorizationRule).find({
      where: { workspaceId },
      order: { priority: 'DESC', createdAt: 'DESC' },
    });
    const index = rules.findIndex(rule => rule.id === ruleId);
    return index < 0 ? [] : rules.slice(0, index).filter(rule => rule.isActive);
  }

  /**
   * What a rule would match, as the caller sees the rows: another member's
   * private row is left out entirely, since even its amount would answer a
   * question about it. A match whose category a rule ranked above sets is
   * marked with that rule.
   */
  async previewRule(input: {
    workspaceId: string;
    viewerMemberId: string | null;
    conditions: ClassificationCondition[];
    matchMode?: MatchMode;
    transactionIds?: readonly string[];
    ruleId?: string;
    /** The account the rule sets: matches elsewhere would move there. */
    walletId?: string;
  }) {
    const { rows, truncated } = await this.rowsForRule(input.workspaceId, input.transactionIds);
    const above = await this.rulesAbove(input.workspaceId, input.ruleId);
    const readable = rows.filter(row => canReadPrivate(row, input.viewerMemberId));
    const matches = readable
      .filter(row => matchesRule(row, input))
      .map(row => {
        // Rules add up, so only a rule that sets a category takes that from this one.
        const winner = above.find(rule => rule.result.categoryId && matchesRule(row, rule));
        return { row, wonBy: winner ? { id: winner.id, name: winner.name } : null };
      });
    return {
      totalTransactions: readable.length,
      matchedTransactions: matches.length,
      overridable: matches.filter(({ row }) => !hasDecidedCategory(row)).length,
      shadowed: matches.filter(({ wonBy }) => wonBy).length,
      movable: matches.filter(({ row }) => movesToWallet(row, input.walletId)).length,
      truncated,
      matches: matches.slice(0, RULE_PREVIEW_MATCHES).map(({ row, wonBy }) => ({
        id: row.id,
        date: row.transactionDate ? String(row.transactionDate) : null,
        amount: row.debit || row.credit || row.amount,
        counterparty: row.counterpartyName,
        purpose: row.paymentPurpose,
        matchReason: explainMatch(row, input.conditions, input.matchMode),
        direction: row.transactionType ?? null,
        currency: row.currency,
        categoryId: row.categoryId ?? null,
        decided: hasDecidedCategory(row),
        wonBy,
      })),
    };
  }

  /**
   * Files the workspace's existing matches under the rule's category, adds its
   * tags and comment, moves them to its account and gives them its payee, a page
   * of rows at a time until every
   * row was looked at. Which rows change is `planRuleApply`'s call: a category
   * or an account a rule ranked above sets on a row is left to that rule. The owner
   * is not touched on old rows: nothing tells an owner somebody assigned from
   * one the row inherited. A rule naming what is not this workspace's applies
   * nothing, as on import.
   */
  async applyRuleToExisting(input: {
    rule: CategorizationRule;
    userId: string;
    viewerMemberId: string | null;
  }): Promise<RuleApplyTotals> {
    const { rule, userId, viewerMemberId } = input;
    const { workspaceId } = rule;
    const { categoryId, walletId, comment, payeeId } = rule.result;
    const manager = this.transactionRepository.manager;
    const tagIds = await ownedTagIds(manager, workspaceId, rule.result.tagIds);
    const totals = { applied: 0, skippedManual: 0, tagged: 0, moved: 0, commented: 0, renamed: 0 };
    const owned = await ownsRuleRefs(manager, workspaceId, rule.result);
    if (!(owned && (categoryId || walletId || comment || payeeId || tagIds.length > 0))) {
      return totals;
    }
    const above = await this.rulesAbove(workspaceId, rule.id);
    let touchedRows = 0;
    for await (const rows of this.pagesForRule(workspaceId)) {
      const plan = planRuleApply(rows, rule, {
        above,
        viewerMemberId,
        setsCategory: Boolean(categoryId),
        setsTags: tagIds.length > 0,
        walletId,
        comment,
        payeeId,
      });
      const idsOf = (rows: Transaction[]) => rows.map(row => row.id);
      const refiledIds = plan.refiled.map(row => row.id);
      if (refiledIds.length > 0) {
        await this.transactionRepository.update(
          { id: In(refiledIds), workspaceId },
          { categoryId, categorySource: TransactionCategorySource.RULE, categoryReason: rule.name },
        );
        // A raw update: the tax subscriber did not see the new category.
        await this.taxAssignmentService.reassess(workspaceId, { ids: refiledIds });
      }
      if (plan.moved.length > 0) {
        await this.transactionRepository.update(
          { id: In(idsOf(plan.moved)), workspaceId },
          { walletId },
        );
      }
      if (plan.commented.length > 0) {
        await this.transactionRepository.update(
          { id: In(idsOf(plan.commented)), workspaceId },
          { comments: comment },
        );
      }
      if (plan.renamed.length > 0) {
        const renamedIds = idsOf(plan.renamed);
        await this.transactionRepository.update(
          { id: In(renamedIds), workspaceId },
          { payeeId, payeeSource: 'rule' },
        );
        // The payee decides the reverse charge, and the tax subscriber did not see it change.
        await this.taxAssignmentService.reassess(workspaceId, { ids: renamedIds });
      }
      await addTransactionTags(
        manager,
        workspaceId,
        plan.tagged.map(row => row.id),
        tagIds,
      );
      const events = ruleApplyEvents(plan, { rule, userId, tagIds });
      await this.auditService.createBatchEvents(events);
      touchedRows += events.length;
      totals.applied += refiledIds.length;
      totals.skippedManual += categoryId ? plan.matches.length - refiledIds.length : 0;
      totals.tagged += plan.tagged.length;
      totals.moved += plan.moved.length;
      totals.commented += plan.commented.length;
      totals.renamed += plan.renamed.length;
    }
    if (touchedRows > 0) {
      await this.classificationService.recordRuleMatch(rule.id, workspaceId, touchedRows);
      await this.cacheManager.set(`reports:version:${workspaceId}`, Date.now().toString(), 0);
    }
    return totals;
  }
}
