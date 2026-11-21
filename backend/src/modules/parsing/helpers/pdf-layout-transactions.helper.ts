import type { ParsedTransaction } from '../interfaces/parsed-statement.interface';
import type { LayoutTransaction } from './pdf-layout-table.helper';
import {
  type DateParts,
  type NumericDateOrder,
  parseDateParts,
  resolveDate,
} from './statement-date.helper';

/**
 * Rows read from a statement's table, turned into what the parser returns:
 * transactions in the common shape, grouped by account, and the balance the
 * first row's running balance implies.
 */

/** The day/month order placeholder in `date` is only right for unambiguous dates. */
export function reparseDate(transaction: LayoutTransaction, order: NumericDateOrder): DateParts {
  return parseDateParts(transaction.dateText, order) ?? transaction.date;
}

/** A row's day as a number; "6/11/2021" is read in the statement's own order when it is known. */
function dayOf(row: LayoutTransaction, order?: NumericDateOrder) {
  const date = order ? reparseDate(row, order) : row.date;
  return (date.year ?? 0) * 10000 + date.month * 100 + date.day;
}

/**
 * The rows oldest first: a statement that lists them newest first ("08/16,
 * 08/16, 08/15") is read backwards. Only dates that never rise count as
 * newest first: a year turning over keeps the order as printed.
 */
export function oldestFirst(
  transactions: LayoutTransaction[],
  order?: NumericDateOrder,
): LayoutTransaction[] {
  const days = transactions.map(row => dayOf(row, order));
  const falling =
    days.some((day, index) => index > 0 && day < days[index - 1]) &&
    days.every((day, index) => index === 0 || day <= days[index - 1]);
  return falling ? [...transactions].reverse() : transactions;
}

/** The running balance after the newest row. */
export function closingBalanceFromRows(
  transactions: LayoutTransaction[],
  order?: NumericDateOrder,
): number | null {
  return oldestFirst(transactions, order).at(-1)?.balance ?? null;
}

/** Balance before the oldest row, undone from its running balance. */
export function openingBalanceFromRows(
  transactions: LayoutTransaction[],
  order?: NumericDateOrder,
): number | null {
  const first = oldestFirst(transactions, order)[0];
  if (first?.balance === undefined) {
    return null;
  }
  const net = (first.credit ?? 0) - (first.debit ?? 0) + (first.amount ?? 0);
  return Number((first.balance - net).toFixed(2));
}

/**
 * Transactions in the shape every parser returns. Without a counterparty
 * column the description is the best name there is, so it fills both. On a
 * card statement a positive amount is a charge.
 */
export function toParsedTransactions(
  transactions: LayoutTransaction[],
  order: NumericDateOrder,
  anchor: Date | null,
  currency: string,
  isCard = false,
): ParsedTransaction[] {
  return transactions.map(transaction => {
    const amount =
      transaction.amount !== undefined && isCard ? -transaction.amount : transaction.amount;
    return {
      transactionDate: resolveDate(reparseDate(transaction, order), anchor),
      counterpartyName: transaction.counterparty || transaction.description,
      counterpartyAccount: transaction.counterpartyAccount,
      paymentPurpose: transaction.description,
      debit: transaction.debit ?? (amount !== undefined && amount < 0 ? -amount : undefined),
      credit: transaction.credit ?? (amount !== undefined && amount >= 0 ? amount : undefined),
      currency,
    };
  });
}

/**
 * Rows grouped by the account heading printed above their table, in the
 * order the accounts appear. A statement with one account (or none named)
 * comes back as a single group.
 */
export function splitByAccount(transactions: LayoutTransaction[]): LayoutTransaction[][] {
  const groups = new Map<string, LayoutTransaction[]>();
  // One account named in all the headings: rows before the first heading are its too
  // ("Account number: 12-34567" printed over the table from the second page on).
  const named = new Set(transactions.map(row => row.account?.accountNumber).filter(Boolean));
  const only = named.size === 1 ? [...named][0] : undefined;
  for (const transaction of transactions) {
    const key = transaction.account?.accountNumber ?? only ?? '';
    groups.set(key, [...(groups.get(key) ?? []), transaction]);
  }
  return [...groups.values()];
}
