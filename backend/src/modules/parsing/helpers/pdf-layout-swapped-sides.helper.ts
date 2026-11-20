import type { LayoutTransaction } from './pdf-layout-table.helper';

const round = (value: number) => Math.round(value * 100) / 100;

/** How many rows' running balance follows from the row above with their money as read. */
function chained(rows: LayoutTransaction[], swap: boolean): number {
  let fits = 0;
  for (let index = 1; index < rows.length; index += 1) {
    const [above, row] = [rows[index - 1], rows[index]];
    if (above.balance === undefined || row.balance === undefined) {
      continue;
    }
    const net = (row.credit ?? 0) - (row.debit ?? 0);
    fits += round(above.balance + (swap ? -net : net)) === round(row.balance) ? 1 : 0;
  }
  return fits;
}

/**
 * A table whose "Debit" and "Credit" headings sit over each other's money:
 * the running balance falls under every "credit" and rises under every
 * "debit". When the balances follow the rows only with the sides swapped,
 * they are swapped; otherwise the rows are left as read.
 */
export function withSidesByBalance(rows: LayoutTransaction[]): LayoutTransaction[] {
  if (chained(rows, true) <= chained(rows, false)) {
    return rows;
  }
  return rows.map(({ debit, credit, ...row }) => ({
    ...row,
    ...(credit !== undefined && { debit: credit }),
    ...(debit !== undefined && { credit: debit }),
  }));
}

/**
 * A table whose money columns sit too close to tell apart by position
 * (amounts set right under "Debit" run past "Credit"): each row's side is
 * the one its running balance moved by, from the row above or, for the
 * first row, from the opening balance. A row whose balance moved by neither
 * stays as read.
 */
export function withSidesFromBalances(
  rows: LayoutTransaction[],
  opening?: number,
): LayoutTransaction[] {
  return rows.map((row, index) => {
    const before = index === 0 ? opening : rows[index - 1].balance;
    const amount = row.credit ?? row.debit;
    if (before === undefined || row.balance === undefined || amount === undefined) {
      return row;
    }
    const { debit: _debit, credit: _credit, ...rest } = row;
    if (round(before - amount) === round(row.balance)) {
      return { ...rest, debit: amount };
    }
    return round(before + amount) === round(row.balance) ? { ...rest, credit: amount } : row;
  });
}
