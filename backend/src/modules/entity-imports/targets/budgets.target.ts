import { BudgetPeriodType } from '../../../entities/budget.entity';
import { budgetsByCategory, upsertBudget } from '../helpers/budget-upsert';
import { normalizeCurrencyCode, parseImportNumber } from '../helpers/import-values';
import { resolveEnumAlias } from '../target-aliases';
import type { ImportContext, ImportTarget, RowResult } from './target.types';

/**
 * One budget per category and period (goal-less). An existing one gets its
 * limit replaced, keeping the old limit for undo; a new category is created.
 */
export class BudgetsTarget implements ImportTarget {
  readonly kind = 'budgets' as const;

  async run(rows: string[][], ctx: ImportContext, dryRun: boolean): Promise<RowResult[]> {
    const byKey = await budgetsByCategory(ctx);
    const seenInFile = new Set<string>();
    const results: RowResult[] = [];
    for (const [index, row] of rows.entries()) {
      const categoryName = ctx.cell(row, 'category').trim();
      const { value, currency: cellCurrency } = parseImportNumber(ctx.cell(row, 'limit'));
      if (!categoryName) {
        results.push({ index, status: 'error', reason: 'category' });
        continue;
      }
      if (value === null || value <= 0) {
        results.push({ index, status: 'error', reason: 'limit' });
        continue;
      }
      const periodType =
        (resolveEnumAlias('frequency', ctx.cell(row, 'periodType')) as BudgetPeriodType | null) ??
        BudgetPeriodType.MONTHLY;
      const fileKey = `${categoryName.toLowerCase()}|${periodType}`;
      if (seenInFile.has(fileKey)) {
        results.push({ index, status: 'skipped', reason: 'duplicate' });
        continue;
      }
      seenInFile.add(fileKey);
      if (dryRun) {
        // Category lookup is read-only in a dry run; new categories count as created.
        results.push({ index, status: 'created' });
        continue;
      }
      const categoryId = await ctx.category(categoryName, 'expense');
      if (!categoryId) {
        results.push({ index, status: 'error', reason: 'category' });
        continue;
      }
      const outcome = await upsertBudget(ctx, byKey, {
        categoryId,
        periodType,
        limit: value,
        currency: normalizeCurrencyCode(ctx.cell(row, 'currency')) ?? cellCurrency ?? ctx.currency,
        name: ctx.cell(row, 'name').trim() || categoryName,
      });
      results.push({ index, ...outcome });
    }
    return results;
  }
}
