import type { EntityManager } from 'typeorm';
import { type TaxRule, TaxRuleDirection } from '../../entities/tax-rule.entity';
import { TransactionType } from '../../entities/transaction.entity';

/**
 * Which way a row books for the tax rules: by its category's type when it has
 * one, else by the row. A refund of a purchase arrives as income but sits in
 * the expense category it undoes, and must take the purchase's rate, or the
 * pair stops netting to nothing.
 */
export async function ruleDirectionOf(
  manager: EntityManager,
  workspaceId: string,
  categoryId: string,
  transactionType: TransactionType,
): Promise<TaxRuleDirection> {
  const [category]: Array<{ type: string }> = await manager.query(
    'SELECT "type" FROM "categories" WHERE "id" = $1 AND "workspace_id" = $2',
    [categoryId, workspaceId],
  );
  if (category?.type === 'income') return TaxRuleDirection.INCOME;
  if (category?.type === 'expense') return TaxRuleDirection.EXPENSE;
  return transactionType === TransactionType.INCOME
    ? TaxRuleDirection.INCOME
    : TaxRuleDirection.EXPENSE;
}

/** The rule that applies: same direction (or both) and category (or any), highest priority, the specific one first. */
export function bestRule(
  rules: TaxRule[],
  direction: TaxRuleDirection,
  categoryId: string,
): TaxRule | null {
  const matches = rules.filter(
    rule =>
      (rule.direction === TaxRuleDirection.BOTH || rule.direction === direction) &&
      (rule.categoryId === null || rule.categoryId === categoryId),
  );
  matches.sort((a, b) => {
    if (a.priority !== b.priority) {
      return b.priority - a.priority;
    }
    const aSpecific = a.categoryId === null ? 0 : 1;
    const bSpecific = b.categoryId === null ? 0 : 1;
    return bSpecific - aSpecific;
  });
  return matches[0] ?? null;
}
