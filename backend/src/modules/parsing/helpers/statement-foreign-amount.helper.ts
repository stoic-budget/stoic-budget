import { parseStatementAmount } from './statement-amount.helper';
import { CURRENCY_CODES } from './statement-currency-codes.helper';

/**
 * The amount a row moved in another currency, as the lines under it print it:
 * "dne 6.3.2026, částka 50.00 PLN", "40,00 EUR kurz: 25,100 CZK/EUR",
 * "3,00 EUR;ORLEN 731;Svit;SVK", a line "EUR 12,50" or "3,00 EUR", or the
 * figure and its code ending a line after an account ("DE89… 100,00 EUR").
 * Card payments abroad are booked in the account's currency; this is the
 * original.
 */

const FIGURE = String.raw`\d{1,3}(?:[ .,]\d{3})*(?:[.,]\d{2})?|\d+(?:[.,]\d+)?`;
/** A figure with its two decimals: a line of a code and a whole number is a message ("FAK 2026001"). */
const MONEY = String.raw`\d{1,3}(?:[ .,]\d{3})*[.,]\d{2}`;

const PATTERNS: RegExp[] = [
  // "částka 50.00 PLN" (Fio), wrapped onto the next line too.
  new RegExp(String.raw`[čČ][aáAÁ]stka\s+(${FIGURE})\s+([A-Z]{3})\b`, 'gu'),
  // "40,00 EUR kurz: 25,100 CZK/EUR" (a rate after it).
  new RegExp(String.raw`(?:^|\s)(${FIGURE})\s?([A-Z]{3})\s+kurz\b`, 'gu'),
  // "3,00 EUR;ORLEN CS 731 SVIT; Svit; SVK" (Raiffeisenbank's card detail).
  new RegExp(String.raw`(?:^|\n)\s*(${FIGURE})\s?([A-Z]{3});`, 'gu'),
  // A line of only the code and the figure: "EUR 12,50" (UniCredit).
  new RegExp(String.raw`(?:^|\n)\s*([A-Z]{3})\s+(${MONEY})\s*(?=\n|$)`, 'gu'),
  // The figure and its code ending a line: "3,00 EUR", "DE89370400440532013000 100,00 EUR" (Raiffeisenbank).
  new RegExp(String.raw`(?:^|\s)(${MONEY})\s?([A-Z]{3})\s*(?=\n|$)`, 'gu'),
];

/**
 * The rate printed beside the original, in this order: "kurz: 25,100
 * CZK/EUR", "kurz 25.1"; after a pair of codes ("1,00 EUR/CZK 25,400000",
 * UniCredit); before it ("25,10 CZK/EUR", Raiffeisenbank). Codes are capitals:
 * "0,10 CZK/min" is no rate.
 */
const RATES = [
  /\bkurz:?\s*(\d+(?:[.,]\d+)?)/iu,
  /\b[A-Z]{3}\/[A-Z]{3}[ \t]+(\d+[.,]\d+)/u,
  /(\d+[.,]\d+)\s?[A-Z]{3}\/[A-Z]{3}\b/u,
];

/** Within this share of the booked amount, a printed rate fits the original. */
const RATE_TOLERANCE = 0.05;

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
 * The rate in units of the account's currency per unit of the original: the
 * printed one when it fits the booked amount, turned over when it was printed
 * the other way ("0,0398 EUR/CZK"), else worked out from the two amounts; the
 * printed one as it is when there is no booked amount to hold it to.
 */
function rateFor(text: string, amount: number, booked?: number): number | undefined {
  const printed = RATES.map(pattern => text.match(pattern)?.[1]).find(Boolean);
  const value = printed ? Number(printed.replace(',', '.')) : null;
  if (!booked) {
    return value ?? undefined;
  }
  const fits = (rate: number) =>
    Math.abs(amount * rate - Math.abs(booked)) <= Math.abs(booked) * RATE_TOLERANCE;
  if (value && fits(value)) {
    return value;
  }
  if (value && fits(1 / value)) {
    return Math.round((1 / value) * 1e6) / 1e6;
  }
  return Math.round((Math.abs(booked) / amount) * 1e6) / 1e6;
}

/**
 * The original amount and currency printed in a row's lines, or null when
 * there is none or only the account's own currency ("částka 840.00 EUR" on a
 * euro account repeats the amount; "CZK 759,00" before a foreign line is
 * skipped). With the row's booked amount the rate is held to it.
 */
export function findForeignAmount(
  text: string,
  accountCurrency: string,
  bookedAmount?: number,
): ForeignAmount | null {
  for (const pattern of PATTERNS) {
    for (const match of text.matchAll(pattern)) {
      const codeFirst = /^[A-Z]{3}$/.test(match[1]);
      const [code, printed] = codeFirst ? [match[1], match[2]] : [match[2], match[1]];
      const amount = figure(printed);
      if (!CURRENCY_CODES.has(code) || code === accountCurrency || amount === null) {
        continue;
      }
      const rate = rateFor(text, amount, bookedAmount);
      return { amount, currency: code, ...(rate ? { rate } : {}) };
    }
  }
  return null;
}
