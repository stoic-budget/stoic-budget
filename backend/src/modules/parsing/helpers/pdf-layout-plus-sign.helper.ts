import type { LayoutTransaction } from './pdf-layout-table.helper';

/**
 * A statement that marks money in with a plus ("+ $400.00") and prints money
 * out bare ("$375.00"): when some amounts carry the plus and none is negative,
 * the bare ones are money out. Rows from a table that prints both signs, or
 * neither, are left as they are.
 */
export function readBareAmountsAsDebits(transactions: LayoutTransaction[]): LayoutTransaction[] {
  const amounts = transactions.filter(row => row.amount !== undefined);
  const plusMarked = amounts.some(row => row.plusMarked);
  if (!plusMarked || amounts.some(row => (row.amount ?? 0) < 0)) {
    return transactions;
  }
  return transactions.map(row =>
    row.amount !== undefined && !row.plusMarked ? { ...row, amount: -row.amount } : row,
  );
}
