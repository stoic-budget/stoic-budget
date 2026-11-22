import { parseAppAmount, readDateColumn, unescapeFormula } from '../app-amounts';
import { cellOf, type DetectedFormat } from '../app-formats';
import { type AppProblem, type AppTxn, appTxn } from '../app-model';

/**
 * Actual Budget's transaction export, read from its source
 * (`packages/loot-core/src/server/transactions/export/export-to-csv.ts`):
 *
 *   exportQueryToCSV (an account's "Export"): Account, Date, Payee, Notes,
 *     Category_Group, Category, Amount, Split_Amount, Cleared. A split's parent
 *     row has Amount 0 and the notes `(SPLIT INTO n)`; each child's notes start
 *     `(SPLIT i OF n)`.
 *   exportToCSV: Account, Date, Payee, Notes, Category (`Group: Name`), Amount,
 *     Cleared, Reconciled.
 *
 * Dates are `YYYY-MM-DD`, amounts plain signed numbers with a decimal point,
 * and text that starts with `= + - @` is prefixed with `'` against spreadsheet
 * formulas. A transfer's payee is the other account's name (the transfer payee
 * shows its account's name); an opening balance is the payee `Starting Balance`.
 */
const PARENT = /^\(SPLIT INTO (\d+)\)\s*/;
const CHILD = /^\(SPLIT (\d+) OF (\d+)\)\s*/;
const STARTING_BALANCE = 'starting balance';

export function parseActual(
  fileName: string,
  format: DetectedFormat,
  rows: string[][],
): { txns: AppTxn[]; problems: AppProblem[] } {
  const { columns } = format;
  const cell = (row: string[], name: string) => unescapeFormula(cellOf(row, columns, name));
  const dates = readDateColumn(rows.map(row => cell(row, 'date')));
  const txns: AppTxn[] = [];
  const problems: AppProblem[] = [];
  // Open splits by account, day and size: the children of one parent number 1..n in file order.
  const open = new Map<string, { key: string; next: number }>();

  rows.forEach((row, index) => {
    const line = index + 2;
    const notes = cell(row, 'notes');
    if (PARENT.test(notes)) {
      return;
    }
    const account = cell(row, 'account');
    const date = dates[index];
    const amount = parseAppAmount(cell(row, 'amount'), '.');
    if (!account) {
      problems.push({ fileName, row: line, reason: 'account' });
      return;
    }
    if (!date) {
      problems.push({ fileName, row: line, reason: 'date' });
      return;
    }
    const payee = cell(row, 'payee');
    const opening = payee.toLowerCase() === STARTING_BALANCE;
    if (!amount) {
      if (!opening) {
        problems.push({ fileName, row: line, reason: 'amount' });
      }
      return;
    }
    const child = CHILD.exec(notes);
    let splitKey: string | null = null;
    if (child) {
      const [at, of] = [Number(child[1]), Number(child[2])];
      const slot = `${account}|${date}|${of}`;
      const current = open.get(slot);
      const group =
        current && at === current.next ? current : { key: `${fileName}#${line}`, next: at };
      group.next = at + 1;
      open.set(slot, group);
      splitKey = group.key;
    }
    const { group, category } = categoryOf(cell, row, format.format === 'actual-basic');
    txns.push(
      appTxn({
        fileName,
        row: line,
        account,
        date,
        amount,
        payee,
        memo: child ? notes.slice(child[0].length).trim() : notes,
        group,
        category,
        payeeMayBeAccount: !opening,
        splitKey,
        opening,
      }),
    );
  });
  return { txns, problems };
}

/** The group and category: two columns, or one `Group: Name` cell in the basic export. */
function categoryOf(
  cell: (row: string[], name: string) => string,
  row: string[],
  basic: boolean,
): { group: string | null; category: string | null } {
  const category = cell(row, 'category');
  if (!basic) {
    return { group: cell(row, 'category_group') || null, category: category || null };
  }
  const at = category.indexOf(': ');
  return at > 0
    ? { group: category.slice(0, at).trim(), category: category.slice(at + 2).trim() || null }
    : { group: null, category: category || null };
}
