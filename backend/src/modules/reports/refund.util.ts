/**
 * Money coming back into a category it was spent from (a returned jacket):
 * with refunds netted it lowers that category instead of counting as income.
 * One rule for the reports' cash flow and the category page, so the two agree
 * whichever way the Reports switch is set.
 */
export function isNettedRefund(
  row: { type: 'income' | 'expense'; isTransfer: boolean; categoryId: string | null },
  netRefunds: boolean,
  isExpenseCategory: (categoryId: string) => boolean,
): boolean {
  return (
    netRefunds &&
    row.type === 'income' &&
    !row.isTransfer &&
    row.categoryId !== null &&
    isExpenseCategory(row.categoryId)
  );
}
