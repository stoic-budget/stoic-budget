/** What the tile reads of a budget, whether from the contract or the budgets page's own shape. */
interface BudgetFigures {
  currency: string;
  /** Only a monthly budget's figures are a month's; a weekly or annual one's are not. */
  periodType?: string;
  categoryId?: string;
  category?: { parentId?: string | null } | null;
  /** The goal a budget serves; a standalone budget on the same category wins. */
  goalId?: string | null;
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
 * Only monthly budgets count; a subcategory's budget is left to the budget of
 * any category above it (`parentOf` walks the whole chain, #658), and a goal's
 * budget is left out when a standalone budget covers the same category.
 */
export function leftToSpend(
  budgets: readonly BudgetFigures[],
  month: string,
  parentOf: ReadonlyMap<string, string | null> = new Map(),
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
  // A goal's budget beside a standalone one on the same category counts its money again.
  // Of several goals' budgets on one category with no standalone budget, one counts.
  const covered = new Set(live.filter(b => !b.goalId).map(b => b.categoryId));
  const own = live.filter(b => {
    if (!b.goalId) return true;
    if (covered.has(b.categoryId)) return false;
    covered.add(b.categoryId);
    return true;
  });
  // A counted budget on any category above already counts its subcategories'
  // spending: a budget on the subcategory too would count the same money twice.
  const counted = new Set(live.map(b => b.categoryId).filter(Boolean));
  const above = (b: BudgetFigures) => {
    const chain: string[] = [];
    let parent = b.category?.parentId ?? (b.categoryId ? parentOf.get(b.categoryId) : null) ?? null;
    // A cycle in the categories ends the walk, before it reaches the budget's own category.
    while (parent && parent !== b.categoryId && chain.length < 20 && !chain.includes(parent)) {
      chain.push(parent);
      parent = parentOf.get(parent) ?? null;
    }
    return chain;
  };
  const inMonth = own.filter(b => !above(b).some(id => counted.has(id)));
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
