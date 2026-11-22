import { IsNull } from 'typeorm';
import { Budget, type BudgetPeriodType } from '../../../entities/budget.entity';
import { computePeriodRange } from '../../budgets/budget-period.util';
import type { ImportContext, RowResult } from '../targets/target.types';

type BudgetContext = Pick<
  ImportContext,
  'manager' | 'workspaceId' | 'userId' | 'created' | 'updated'
>;

/** The workspace's goal-less budgets by category and period, the ones an import may replace. */
export async function budgetsByCategory(ctx: BudgetContext): Promise<Map<string, Budget>> {
  const existing = await ctx.manager
    .getRepository(Budget)
    .find({ where: { workspaceId: ctx.workspaceId, goalId: IsNull() } });
  return new Map(existing.map(item => [`${item.categoryId}|${item.periodType}`, item]));
}

/** What writing this limit would do, without writing it. */
export function budgetOutcome(
  byKey: Map<string, Budget>,
  categoryId: string | null,
  periodType: BudgetPeriodType,
  limit: number,
): RowResult['status'] {
  const current = categoryId ? byKey.get(`${categoryId}|${periodType}`) : undefined;
  if (!current) {
    return 'created';
  }
  return Number(current.limitAmount) === limit ? 'skipped' : 'updated';
}

/**
 * One budget per category and period: an existing one gets its limit replaced
 * (the old limit kept for undo), an equal one is left alone, else one is created.
 */
export async function upsertBudget(
  ctx: BudgetContext,
  byKey: Map<string, Budget>,
  input: {
    categoryId: string;
    periodType: BudgetPeriodType;
    limit: number;
    currency: string;
    name: string;
  },
): Promise<Pick<RowResult, 'status' | 'reason' | 'id'>> {
  const repo = ctx.manager.getRepository(Budget);
  const key = `${input.categoryId}|${input.periodType}`;
  const current = byKey.get(key);
  if (current) {
    if (Number(current.limitAmount) === input.limit) {
      return { status: 'skipped', reason: 'unchanged', id: current.id };
    }
    ctx.updated.push({
      kind: 'budget',
      id: current.id,
      before: { limitAmount: Number(current.limitAmount), currency: current.currency },
    });
    await repo.update(current.id, { limitAmount: input.limit });
    return { status: 'updated', id: current.id };
  }
  const { start } = computePeriodRange(input.periodType, new Date());
  const saved = await repo.save(
    repo.create({
      workspaceId: ctx.workspaceId,
      createdById: ctx.userId,
      name: input.name,
      categoryId: input.categoryId,
      limitAmount: input.limit,
      currency: input.currency,
      periodType: input.periodType,
      currentPeriodStart: start,
      goalId: null,
    }),
  );
  byKey.set(key, saved);
  ctx.created.push({ kind: 'budget', id: saved.id });
  return { status: 'created', id: saved.id };
}
