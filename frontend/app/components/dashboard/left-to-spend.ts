/** What the tile reads of a budget, whether from the contract or the budgets page's own shape. */
interface BudgetFigures {
  currency: string;
  /** Only a monthly budget's figures are a month's; a weekly or annual one's are not. */
  periodType?: string;
  categoryId?: string;
  category?: { parentId?: string | null } | null;
  startsOn?: string | null;
  endsOn?: string | null;
  limitAmount: number | string;
  availableAmount?: number;
  spentAmount: number;
}

/**
 * What the budgets governing a `YYYY-MM` month still allow (`amount`) out of
 * what they allowed in all (`allowed`), per currency, or
 * null when none does: no budget yet, or only ones whose window starts after
 * the month or ended before it. Then the tile shows what was spent instead.
 * Only monthly budgets count, and a subcategory's budget is left to its
 * parent's when the parent has one.
 */
export function leftToSpend(
  budgets: readonly BudgetFigures[],
  month: string,
): Array<{ currency: string; amount: number; allowed: number }> | null {
  const [year, index] = month.split('-').map(Number);
  const first = `${month}-01`;
  const last = `${month}-${String(new Date(year, index, 0).getDate()).padStart(2, '0')}`;
  // Monthly budgets live in the month; only they make a month's figures.
  const live = budgets.filter(
    b =>
      (b.periodType ?? 'monthly') === 'monthly' &&
      (!b.startsOn || b.startsOn <= last) &&
      (!b.endsOn || b.endsOn >= first),
  );
  // A counted budget on a parent category already counts its subcategories'
  // spending: a budget on the subcategory too would count the same money twice.
  const counted = new Set(live.map(b => b.categoryId).filter(Boolean));
  const inMonth = live.filter(b => !(b.category?.parentId && counted.has(b.category.parentId)));
  if (inMonth.length === 0) {
    return null;
  }
  const totals = new Map<string, { amount: number; allowed: number }>();
  for (const b of inMonth) {
    const allowed = Number(b.availableAmount ?? b.limitAmount);
    const total = totals.get(b.currency) ?? { amount: 0, allowed: 0 };
    totals.set(b.currency, {
      amount: total.amount + allowed - b.spentAmount,
      allowed: total.allowed + allowed,
    });
  }
  return [...totals].map(([currency, total]) => ({ currency, ...total }));
}
