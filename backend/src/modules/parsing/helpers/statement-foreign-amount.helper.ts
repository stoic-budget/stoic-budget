import { parseStatementAmount } from './statement-amount.helper';
import { CURRENCY_CODES } from './statement-currency-codes.helper';

/**
 * The amount a row moved in another currency, as the lines under it print it:
 * "dne 6.3.2026, částka 50.00 PLN", "40,00 EUR kurz: 25,100 CZK/EUR",
 * "3,00 EUR;ORLEN 731;Svit;SVK", a line "EUR 12,50". Card payments abroad are
 * booked in the account's currency; this is the original.
 */

const FIGURE = String.raw`\d{1,3}(?:[ .,]\d{3})*(?:[.,]\d{2})?|\d+(?:[.,]\d+)?`;
/** A figure with its two decimals: a line of a code and a whole number is a message ("FAK 2026001"). */
const MONEY = String.raw`\d{1,3}(?:[ .,]\d{3})*[.,]\d{2}`;

const PATTERNS: RegExp[] = [
  // "částka 50.00 PLN" (Fio), wrapped onto the next line too.
  new RegExp(String.raw`[čČ][aáAÁ]stka\s+(${FIGURE})\s+([A-Z]{3})\b`, 'u'),
  // "40,00 EUR kurz: 25,100 CZK/EUR" (a rate after it).
  new RegExp(String.raw`(?:^|\s)(${FIGURE})\s?([A-Z]{3})\s+kurz\b`, 'u'),
  // "3,00 EUR;ORLEN CS 731 SVIT; Svit; SVK" (Raiffeisenbank's card detail).
  new RegExp(String.raw`(?:^|\n)\s*(${FIGURE})\s?([A-Z]{3});`, 'u'),
  // A line of only the code and the figure: "EUR 12,50" (UniCredit).
  new RegExp(String.raw`(?:^|\n)\s*([A-Z]{3})\s+(${MONEY})\s*(?:\n|$)`, 'u'),
];

/** "kurz: 25,100 CZK/EUR", "kurz 25.1": the rate printed beside the original. */
const RATE = /\bkurz:?\s*(\d+(?:[.,]\d+)?)/iu;

export interface ForeignAmount {
  /** Positive, in `currency`. */
  amount: number;
  currency: string;
  /** Units of the account's currency per unit of `currency`, when it can be told. */
  rate?: number;
}

function figure(text: string): number | null {
  const value = parseStatementAmount(text) ?? Number(text.replace(',', '.'));
  return Number.isFinite(value) && value !== 0 ? Math.abs(value) : null;
}

/**
 * The original amount and currency printed in a row's lines, or null when
 * there is none or it is in the account's own currency ("částka 840.00 EUR"
 * on a euro account only repeats the amount). With the row's booked amount the
 * rate is worked out when the statement prints none.
 */
export function findForeignAmount(
  text: string,
  accountCurrency: string,
  bookedAmount?: number,
): ForeignAmount | null {
  for (const pattern of PATTERNS) {
    const match = text.match(pattern);
    if (!match) {
      continue;
    }
    const codeFirst = /^[A-Z]{3}$/.test(match[1]);
    const [code, printed] = codeFirst ? [match[1], match[2]] : [match[2], match[1]];
    const amount = figure(printed);
    if (!CURRENCY_CODES.has(code)) {
      // "ATM 500", "částka 200 dne": no currency, maybe one further on.
      continue;
    }
    if (amount === null || code === accountCurrency) {
      return null;
    }
    const printedRate = text.match(RATE);
    const rate = printedRate
      ? Number(printedRate[1].replace(',', '.'))
      : bookedAmount
        ? Math.round((Math.abs(bookedAmount) / amount) * 1e6) / 1e6
        : undefined;
    return { amount, currency: code, ...(rate ? { rate } : {}) };
  }
  return null;
}
