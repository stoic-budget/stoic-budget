import { ActorType, AuditAction, EntityType } from '../../../entities/audit-event.entity';
import type { CategorizationRule } from '../../../entities/categorization-rule.entity';
import { type Transaction, TransactionCategorySource } from '../../../entities/transaction.entity';
import type { CreateAuditEventDto } from '../../audit/interfaces/audit-event.interface';
import type { RuleApplyPlan } from '../engine/rule-apply-plan';
import type { RuleLayers } from '../engine/rule-layers';
import type { ClassificationCondition } from '../interfaces/classification-rule.interface';

export type CategorizationRuleAuditSnapshot = {
  id: string;
  userId: string;
  workspaceId: string;
  name: string;
  description: string | null;
  conditions: ClassificationCondition[];
  matchMode: CategorizationRule['matchMode'];
  result: CategorizationRule['result'];
  priority: number;
  isActive: boolean;
  matchCount: number;
  lastMatchedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

/** A rule as the audit trail keeps it, before and after a change. */
export function toRuleAuditSnapshot(rule: CategorizationRule): CategorizationRuleAuditSnapshot {
  return {
    id: rule.id,
    userId: rule.userId,
    workspaceId: rule.workspaceId,
    name: rule.name,
    description: rule.description,
    conditions: rule.conditions,
    matchMode: rule.matchMode,
    result: rule.result,
    priority: rule.priority,
    isActive: rule.isActive,
    matchCount: rule.matchCount,
    lastMatchedAt: rule.lastMatchedAt?.toISOString() || null,
    createdAt: rule.createdAt.toISOString(),
    updatedAt: rule.updatedAt.toISOString(),
  };
}

/**
 * One event per row an apply changed, with what it was before: the category,
 * the account, the comment and the payee can be put back from it. A row that only got tags has no
 * diff, since tags are added and nothing is taken away.
 */
export function ruleApplyEvents(
  plan: RuleApplyPlan,
  input: { rule: CategorizationRule; userId: string; tagIds: readonly string[] },
): CreateAuditEventDto[] {
  const { rule, userId, tagIds } = input;
  const { categoryId, walletId, comment, payeeId } = rule.result;
  const idsOf = (rows: readonly Transaction[]) => new Set(rows.map(row => row.id));
  const refiled = idsOf(plan.refiled);
  const moved = idsOf(plan.moved);
  const commented = idsOf(plan.commented);
  const renamed = idsOf(plan.renamed);
  const touched = idsOf([
    ...plan.refiled,
    ...plan.moved,
    ...plan.tagged,
    ...plan.commented,
    ...plan.renamed,
  ]);
  return plan.matches
    .filter(row => touched.has(row.id))
    .map(row => {
      const before: Record<string, unknown> = {};
      const after: Record<string, unknown> = {};
      if (refiled.has(row.id)) {
        Object.assign(before, { categoryId: row.categoryId, categorySource: row.categorySource });
        Object.assign(after, { categoryId, categorySource: TransactionCategorySource.RULE });
      }
      if (moved.has(row.id)) {
        before.walletId = row.walletId;
        after.walletId = walletId;
      }
      if (commented.has(row.id)) {
        before.comments = row.comments;
        after.comments = comment;
      }
      if (renamed.has(row.id)) {
        before.payeeId = row.payeeId;
        after.payeeId = payeeId;
      }
      return {
        workspaceId: rule.workspaceId,
        actorType: ActorType.USER,
        actorId: userId,
        entityType: EntityType.TRANSACTION,
        entityId: row.id,
        action: AuditAction.APPLY_RULE,
        diff: Object.keys(after).length > 0 ? { before, after } : null,
        meta: { ruleId: rule.id, ruleName: rule.name, confidence: 1, tagIds: [...tagIds] },
      };
    });
}

/**
 * One event per rule that added something to a row being classified, so the
 * row's history names each of them. A row not booked yet has no id to hang an
 * event on and gets none.
 */
export function ruleApplicationEvents(input: {
  transaction: Pick<Transaction, 'id' | 'workspaceId'>;
  layers: RuleLayers;
  userId: string;
  batchId?: string | null;
}): CreateAuditEventDto[] {
  const { transaction, layers, userId, batchId } = input;
  if (!transaction.id) {
    return [];
  }
  return layers.contributors.map(rule => ({
    workspaceId: transaction.workspaceId ?? null,
    actorType: ActorType.USER,
    actorId: userId,
    entityType: EntityType.TRANSACTION,
    entityId: transaction.id,
    action: AuditAction.APPLY_RULE,
    meta: { ruleId: rule.id, ruleName: rule.name, confidence: 1 },
    batchId: batchId ?? null,
  }));
}
