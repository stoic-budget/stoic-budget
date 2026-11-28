import type { EntityManager, Repository } from 'typeorm';
import { type TaxRule, TaxRuleDirection } from '../../entities/tax-rule.entity';
import { TransactionType } from '../../entities/transaction.entity';

/**
 * Which way a row books for the tax rules when no rule matches its own
 * direction: by its category's type when it has one, else by the row. A refund of a purchase arrives as income but sits in
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
  return directionOfRow(transactionType);
}

/** The direction money moved in: in for income, out for anything else. */
export function directionOfRow(transactionType: TransactionType): TaxRuleDirection {
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

/**
 * The tax rule for a categorised row, highest priority first and a rule naming
 * the category before a catch-all. A rule for the row's own direction is tried
 * first, so one set up by hand is honoured; with none, the category's type
 * decides, and a refund takes the rule of the purchase it undoes.
 */
export async function matchingRule(
  rules: Repository<TaxRule>,
  manager: EntityManager,
  row: { workspaceId: string; categoryId: string; transactionType: TransactionType },
): Promise<TaxRule | null> {
  const enabled = await rules.find({ where: { workspaceId: row.workspaceId, isEnabled: true } });
  return (
    bestRule(enabled, directionOfRow(row.transactionType), row.categoryId) ??
    bestRule(
      enabled,
      await ruleDirectionOf(manager, row.workspaceId, row.categoryId, row.transactionType),
      row.categoryId,
    )
  );
}
