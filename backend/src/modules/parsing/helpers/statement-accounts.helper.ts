import type { PdfTextRow } from '../../../common/utils/pdf-parser.util';
import type {
  ParseCheck,
  ParsedStatement,
  ParsedTransaction,
} from '../interfaces/parsed-statement.interface';
import { accountHeadingAt } from './pdf-layout-account-number.helper';
import type { LayoutTransaction } from './pdf-layout-table.helper';
import {
  closingBalanceFromRows,
  openingBalanceFromRows,
  toParsedTransactions,
} from './pdf-layout-transactions.helper';
import { checkBalanceChain, checkDatesInPeriod } from './statement-checks.helper';
import type { NumericDateOrder } from './statement-date.helper';
import { findHeaderPeriod } from './statement-header-period.helper';
import { findStatementBalances } from './statement-metadata.helper';

/** Rows a week either side of a printed range still place it. */
const PERIOD_SLACK_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * A printed range is the statement's period only if its rows fall in it: "fee
 * based on your balance from 1 Sep 2024 to 30 Nov 2024" on a statement of
 * September 2025 is a note. A statement without rows keeps the range.
 */
export function plausiblePeriod<T extends { from: Date | null; to: Date | null }>(
  range: T | null,
  transactions: ParsedTransaction[],
): T | null {
  const { from, to } = range ?? {};
  if (!(from && to) || transactions.length === 0) {
    return range;
  }
  const inside = transactions.some(
    row =>
      row.transactionDate.getTime() >= from.getTime() - PERIOD_SLACK_MS &&
      row.transactionDate.getTime() <= to.getTime() + PERIOD_SLACK_MS,
  );
  return inside ? range : null;
}

/**
 * The text printed under each account heading, up to the next heading, in
 * the order the accounts first appear. A heading repeated at the top of every
 * page hands the lines back to its account until the next one takes over.
 */
export function accountTexts(rows: PdfTextRow[]): Map<string, string> {
  const texts = new Map<string, string[]>();
  let current: string | null = null;
  let above: PdfTextRow | null = null;
  for (const row of [...rows].sort((a, b) => a.page - b.page || a.y - b.y)) {
    current = accountHeadingAt(row, above)?.accountNumber ?? current;
    above = row;
    if (current) {
      texts.set(current, [
        ...(texts.get(current) ?? []),
        row.items.map(item => item.text).join(' '),
      ]);
    }
  }
  return new Map([...texts].map(([account, lines]) => [account, lines.join('\n')]));
}

export interface AccountContext {
  text: string;
  /** The text under each account's heading (`accountTexts`). */
  texts: Map<string, string>;
  dateOrder: NumericDateOrder;
  latestPrinted: Date | null;
  currency: string;
  isCard: boolean;
}

/**
 * One account of a file that prints several, each in its own table under a
 * heading naming its number and currency. The running balance column gives
 * its balances; else the balances labelled under its own heading.
 */
export function accountStatement(
  rows: LayoutTransaction[],
  accountNumber: string,
  context: AccountContext,
): ParsedStatement {
  const { text, dateOrder, isCard } = context;
  const currency = rows[0]?.account?.currency ?? context.currency;
  const transactions = toParsedTransactions(
    rows,
    dateOrder,
    context.latestPrinted,
    currency,
    isCard,
  );
  const times = transactions.map(t => t.transactionDate.getTime());
  const period = plausiblePeriod(findHeaderPeriod(text, dateOrder), transactions);
  const labelled = findStatementBalances(context.texts.get(accountNumber) ?? '', dateOrder);
  const sign = isCard ? -1 : 1;
  const balanceStart =
    openingBalanceFromRows(rows, dateOrder) ??
    (labelled.start === null ? null : sign * labelled.start);
  const balanceEnd =
    closingBalanceFromRows(rows, dateOrder) ?? (labelled.end === null ? null : sign * labelled.end);
  return {
    metadata: {
      accountNumber,
      currency,
      dateFrom: period?.from ?? new Date(times.length > 0 ? Math.min(...times) : Date.now()),
      dateTo: period?.to ?? new Date(times.length > 0 ? Math.max(...times) : Date.now()),
      balanceStart: balanceStart ?? undefined,
      balanceEnd: balanceEnd ?? undefined,
    },
    transactions,
    // Labels and totals elsewhere on the page cannot be told apart by account.
    checks: [checkBalanceChain(rows, isCard), checkDatesInPeriod(transactions, period)].filter(
      (check): check is ParseCheck => check !== null,
    ),
  };
}

/**
 * Every account the file prints: those with rows, in the order of their rows,
 * and those whose heading prints both balances but no rows (an account
 * without activity this period), after the account printed before them.
 */
export function accountStatements(
  groups: LayoutTransaction[][],
  context: AccountContext,
): ParsedStatement[] {
  const byAccount = new Map(groups.map(rows => [rows[0].account?.accountNumber ?? '', rows]));
  const order = [...byAccount.keys()];
  const printed = [...context.texts.keys()];
  printed.forEach((account, index) => {
    const { start, end } = findStatementBalances(
      context.texts.get(account) ?? '',
      context.dateOrder,
    );
    if (byAccount.has(account) || start === null || end === null) {
      return;
    }
    const before = printed
      .slice(0, index)
      .reverse()
      .find(other => order.includes(other));
    order.splice(before === undefined ? 0 : order.indexOf(before) + 1, 0, account);
  });
  return order.map(account => accountStatement(byAccount.get(account) ?? [], account, context));
}
