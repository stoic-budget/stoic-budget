import { normalizeNumber } from '../../../common/utils/number-normalizer.util';
import { parseStatementAmount } from './statement-amount.helper';

/**
 * A table cell's amount, its sign wherever the bank put it: "$-12.00",
 * "USD -12.00", "12.00 DR", "1.500,00 (-)". A plain figure ("12", "1 200")
 * that is not printed the statement way still reads as a number.
 */
export function tabularAmount(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value !== 'string' || !value.trim()) {
    return null;
  }
  return parseStatementAmount(value) ?? normalizeNumber(value);
}

const DEBIT_WORDS = new Set(['af', 'debit', 'dr', 'd', 'out', 'withdrawal']);
const CREDIT_WORDS = new Set(['bij', 'credit', 'cr', 'c', 'in', 'deposit']);

/**
 * The side a separate column gives an unsigned amount: ING's "Af"/"Bij",
 * "Debit"/"Credit", "DR"/"CR". Null when the cell says neither.
 */
export function amountSide(value: unknown): 'debit' | 'credit' | null {
  const word = String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\.$/, '');
  if (DEBIT_WORDS.has(word)) {
    return 'debit';
  }
  return CREDIT_WORDS.has(word) ? 'credit' : null;
}

/** A date written as one run of digits, year first: "20260302" (ING, many exports). */
export function compactDate(value: unknown): Date | null {
  const match = String(value ?? '')
    .trim()
    .match(/^(\d{4})(\d{2})(\d{2})$/);
  if (!match) {
    return null;
  }
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
    ? date
    : null;
}
