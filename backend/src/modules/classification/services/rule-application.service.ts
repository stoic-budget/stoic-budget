import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Cache } from 'cache-manager';
import { In, type Repository } from 'typeorm';
import { canReadPrivate } from '../../../common/utils/transaction-privacy.util';
import { ActorType, AuditAction, EntityType } from '../../../entities/audit-event.entity';
import { CategorizationRule } from '../../../entities/categorization-rule.entity';
import { Transaction, TransactionCategorySource } from '../../../entities/transaction.entity';
import { AuditService } from '../../audit/audit.service';
import { TaxAssignmentService } from '../../tax/tax-assignment.service';
import { hasDecidedCategory } from '../engine/category-decision';
import { planRuleApply } from '../engine/rule-apply-plan';
import { explainMatch, matchesConditions } from '../engine/rule-conditions';
import { addTransactionTags, ownedTagIds } from '../engine/rule-tags';
import type { ClassificationCondition } from '../interfaces/classification-rule.interface';
import { ClassificationService } from './classification.service';

/** How many of a workspace's most recent rows a rule preview looks at. */
const RULE_SCAN_LIMIT = 5000;
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
   * question about it. A match a rule ranked above takes is marked with it.
   */
  async previewRule(input: {
    workspaceId: string;
    viewerMemberId: string | null;
    conditions: ClassificationCondition[];
    transactionIds?: readonly string[];
    ruleId?: string;
  }) {
    const { rows, truncated } = await this.rowsForRule(input.workspaceId, input.transactionIds);
    const above = await this.rulesAbove(input.workspaceId, input.ruleId);
    const readable = rows.filter(row => canReadPrivate(row, input.viewerMemberId));
    const matches = readable
      .filter(row => matchesConditions(row, input.conditions))
      .map(row => {
        const winner = above.find(rule => matchesConditions(row, rule.conditions));
        return { row, wonBy: winner ? { id: winner.id, name: winner.name } : null };
      });
    return {
      totalTransactions: readable.length,
      matchedTransactions: matches.length,
      overridable: matches.filter(({ row }) => !hasDecidedCategory(row)).length,
      shadowed: matches.filter(({ wonBy }) => wonBy).length,
      truncated,
      matches: matches.slice(0, RULE_PREVIEW_MATCHES).map(({ row, wonBy }) => ({
        id: row.id,
        date: row.transactionDate ? String(row.transactionDate) : null,
        amount: row.debit || row.credit || row.amount,
        counterparty: row.counterpartyName,
        purpose: row.paymentPurpose,
        matchReason: explainMatch(row, input.conditions),
        direction: row.transactionType ?? null,
        currency: row.currency,
        categoryId: row.categoryId ?? null,
        decided: hasDecidedCategory(row),
        wonBy,
      })),
    };
  }

  /**
   * Files the workspace's existing matches under the rule's category and adds
   * its tags, a page of rows at a time until every row was looked at. Which
   * rows change is `planRuleApply`'s call. Wallet and owner are not touched on
   * old rows: moving a row between accounts changes balances, and that is not
   * what "apply" promises.
   */
  async applyRuleToExisting(input: {
    rule: CategorizationRule;
    userId: string;
    viewerMemberId: string | null;
  }): Promise<{ applied: number; skippedManual: number; tagged: number }> {
    const { rule, userId, viewerMemberId } = input;
    const { workspaceId } = rule;
    const categoryId = rule.result.categoryId;
    const manager = this.transactionRepository.manager;
    const tagIds = await ownedTagIds(manager, workspaceId, rule.result.tagIds);
    const totals = { applied: 0, skippedManual: 0, tagged: 0 };
    if (!categoryId && tagIds.length === 0) {
      return totals;
    }
    let touchedRows = 0;
    for await (const rows of this.pagesForRule(workspaceId)) {
      const plan = planRuleApply(rows, rule, {
        viewerMemberId,
        setsCategory: Boolean(categoryId),
        setsTags: tagIds.length > 0,
      });
      const refiledIds = plan.refiled.map(row => row.id);
      if (refiledIds.length > 0) {
        await this.transactionRepository.update(
          { id: In(refiledIds), workspaceId },
          { categoryId, categorySource: TransactionCategorySource.RULE, categoryReason: rule.name },
        );
        // A raw update: the tax subscriber did not see the new category.
        await this.taxAssignmentService.reassess(workspaceId, { ids: refiledIds });
      }
      await addTransactionTags(
        manager,
        workspaceId,
        plan.tagged.map(row => row.id),
        tagIds,
      );
      const refiled = new Set(refiledIds);
      // Tags go on every match, so with tags every match was touched.
      const touched = plan.tagged.length > 0 ? plan.matches : plan.refiled;
      await this.auditService.createBatchEvents(
        touched.map(row => ({
          workspaceId,
          actorType: ActorType.USER,
          actorId: userId,
          entityType: EntityType.TRANSACTION,
          entityId: row.id,
          action: AuditAction.APPLY_RULE,
          diff: refiled.has(row.id)
            ? {
                before: { categoryId: row.categoryId, categorySource: row.categorySource },
                after: { categoryId, categorySource: TransactionCategorySource.RULE },
              }
            : null,
          meta: { ruleId: rule.id, ruleName: rule.name, confidence: 1, tagIds },
        })),
      );
      touchedRows += touched.length;
      totals.applied += refiledIds.length;
      totals.skippedManual += categoryId ? plan.matches.length - refiledIds.length : 0;
      totals.tagged += plan.tagged.length;
    }
    if (touchedRows > 0) {
      await this.classificationService.recordRuleMatch(rule.id, workspaceId, touchedRows);
      await this.cacheManager.set(`reports:version:${workspaceId}`, Date.now().toString(), 0);
    }
    return totals;
  }
}
