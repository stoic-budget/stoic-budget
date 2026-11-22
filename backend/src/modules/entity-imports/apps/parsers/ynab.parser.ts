import { detectDecimalMark, parseAppAmount, readDateColumn } from '../app-amounts';
import type { Delimiter } from '../app-file-text';
import { cellOf, type DetectedFormat } from '../app-formats';
import { type AppBudgetRow, type AppProblem, type AppTxn, appTxn } from '../app-model';

/**
 * YNAB's "Export plan" files, as documented by YNAB support ("How to Export
 * Plan Data": a plan file and a register file, CSV, or TSV for currencies with
 * a decimal comma). The column names come from open-source readers of these
 * files (hledger's ynab-web-register rules, and several YNAB migration tools):
 *
 *   Register: Account, Flag, Date, Payee, Category Group/Category, Category Group,
 *             Category, Memo, Outflow, Inflow, Cleared
 *   Plan:     Month, Category Group/Category, Category Group, Category, Assigned,
 *             Activity, Available
 *
 * Amounts carry the plan's currency format (`$1,234.56`, `1.234,56€`); dates
 * the plan's date format. Transfers name the other account as the payee
 * `Transfer : <Account>`, each part of a split carries `Split (i/n)` at the
 * start of its memo, opening balances are the payee `Starting Balance`, and
 * income sits in the pseudo-category `Inflow: Ready to Assign`.
 */
const TRANSFER_PREFIX = 'Transfer : ';
const STARTING_BALANCE = 'Starting balance';
const SPLIT_MEMO = /^Split \((\d+)\/(\d+)\)\s*/;
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

/** YNAB's own groups: income waiting to be assigned, and the money set aside for card payments. */
const INFLOW_GROUP = 'inflow';
const CARD_PAYMENTS_GROUP = 'credit card payments';

const isInflow = (group: string) => group.trim().toLowerCase() === INFLOW_GROUP;

export function parseYnabRegister(
  fileName: string,
  format: DetectedFormat,
  rows: string[][],
  delimiter: Delimiter,
): { txns: AppTxn[]; problems: AppProblem[] } {
  const { columns } = format;
  const cell = (row: string[], name: string) => cellOf(row, columns, name);
  const mark = detectDecimalMark(
    rows.flatMap(row => [cell(row, 'outflow'), cell(row, 'inflow')]),
    delimiter === '\t' ? ',' : '.',
  );
  const dates = readDateColumn(rows.map(row => cell(row, 'date')));
  const txns: AppTxn[] = [];
  const problems: AppProblem[] = [];
  let split: { key: string; account: string; date: string; of: number; next: number } | null = null;

  rows.forEach((row, index) => {
    const line = index + 2;
    const date = dates[index];
    const account = cell(row, 'account');
    const outflow = parseAppAmount(cell(row, 'outflow'), mark) ?? 0;
    const inflow = parseAppAmount(cell(row, 'inflow'), mark) ?? 0;
    const amount = Math.round((Math.abs(inflow) - Math.abs(outflow)) * 100) / 100;
    if (!account) {
      problems.push({ fileName, row: line, reason: 'account' });
      return;
    }
    if (!date) {
      problems.push({ fileName, row: line, reason: 'date' });
      return;
    }
    const payee = cell(row, 'payee');
    const rawMemo = cell(row, 'memo');
    const part = SPLIT_MEMO.exec(rawMemo);
    let splitKey: string | null = null;
    if (part) {
      const [at, of] = [Number(part[1]), Number(part[2])];
      // A part continues the split before it only in order, on the same account and day.
      if (
        !(
          split &&
          at === split.next &&
          of === split.of &&
          split.account === account &&
          split.date === date
        )
      ) {
        split = { key: `${fileName}#${line}`, account, date, of, next: at };
      }
      split.next = at + 1;
      splitKey = split.key;
    } else {
      split = null;
    }
    const opening = payee.toLowerCase() === STARTING_BALANCE.toLowerCase();
    if (amount === 0) {
      // An account opened empty says nothing; any other zero row is a problem.
      if (!opening) {
        problems.push({ fileName, row: line, reason: 'amount' });
      }
      return;
    }
    const group = cell(row, 'category group');
    const transferTo = payee.startsWith(TRANSFER_PREFIX)
      ? payee.slice(TRANSFER_PREFIX.length).trim() || null
      : null;
    txns.push(
      appTxn({
        fileName,
        row: line,
        account,
        date,
        amount,
        payee,
        memo: part ? rawMemo.slice(part[0].length).trim() : rawMemo,
        group: group && !isInflow(group) && !transferTo ? group : null,
        category: isInflow(group) || transferTo ? null : cell(row, 'category') || null,
        transferTo,
        splitKey,
        opening,
      }),
    );
  });
  return { txns, problems };
}

/** `Jan 2026` → `2026-01`; an ISO or numeric date gives its month. */
function readMonth(value: string): string | null {
  const named = /^([A-Za-z]{3})[a-z]*\.?\s+(\d{4})$/.exec(value.trim());
  if (named) {
    const month = MONTHS.indexOf(named[1].toLowerCase());
    return month < 0 ? null : `${named[2]}-${String(month + 1).padStart(2, '0')}`;
  }
  const iso = /^(\d{4})-(\d{2})/.exec(value.trim());
  return iso ? `${iso[1]}-${iso[2]}` : null;
}

export function parseYnabPlan(
  fileName: string,
  format: DetectedFormat,
  rows: string[][],
  delimiter: Delimiter,
): { budgets: AppBudgetRow[]; problems: AppProblem[] } {
  const { columns } = format;
  const cell = (row: string[], name: string) => cellOf(row, columns, name);
  const mark = detectDecimalMark(
    rows.map(row => cell(row, 'assigned')),
    delimiter === '\t' ? ',' : '.',
  );
  const budgets: AppBudgetRow[] = [];
  const problems: AppProblem[] = [];
  rows.forEach((row, index) => {
    const line = index + 2;
    const group = cell(row, 'category group');
    const category = cell(row, 'category');
    const lowered = group.toLowerCase();
    // Not spending categories: income to assign, and card payments (transfers here).
    if (isInflow(group) || lowered === CARD_PAYMENTS_GROUP) {
      return;
    }
    const month = readMonth(cell(row, 'month'));
    const assigned = parseAppAmount(cell(row, 'assigned'), mark);
    if (!(month && category) || assigned === null) {
      problems.push({ fileName, row: line, reason: month ? 'amount' : 'date' });
      return;
    }
    budgets.push({ fileName, row: line, month, group: group || null, category, assigned });
  });
  return { budgets, problems };
}
