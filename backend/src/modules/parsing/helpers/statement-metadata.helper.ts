import { findFullDates, foldText, type NumericDateOrder } from './statement-date.helper';
import { CURRENCY_SIGNS, printedCurrency } from './statement-heading-currency.helper';

export {
  findBalanceRowPeriod,
  findStatementBalances,
  findStatementTotals,
  isBalanceLabel,
  isTotalsLabel,
} from './statement-balances.helper';
export { isCreditCardStatement } from './statement-card.helper';

/**
 * Statement header facts read from free text, for statements in English,
 * French, Dutch, German and Spanish.
 */

const ISO_CODES =
  /\b(KZT|UZS|GEL|UAH|BYN|AMD|AZN|KGS|TJS|TMT|USD|EUR|RUB|GBP|CNY|TRY|AED|JPY|CHF|CAD|AUD|SEK|NOK|DKK|PLN|CZK|HUF|RON|INR|BRL|MXN|SGD|HKD|NZD|ZAR|THB|MYR|IDR|ILS|SAR|QAR|KWD|LKR|NGN|KES|PHP|GHS|EGP|BND|EUROS?)\b/g;

const PREFIXED_DOLLARS: [RegExp, string][] = [
  [/\bS\$/, 'SGD'],
  [/\bHK\$/, 'HKD'],
  [/\bC(?:A)?\$/, 'CAD'],
  [/\bA(?:U)?\$/, 'AUD'],
  [/\bNZ\$/, 'NZD'],
  [/\bUS\$/, 'USD'],
  [/\bR\$/, 'BRL'],
];

/**
 * Signs written with letters, glued to a figure with two decimals ("R13.40",
 * "-RM12.00"); a reference such as "R2D2" or "R66" is not money.
 */
const LETTER_SIGNS: [RegExp, string][] = [
  [/(?<![A-Za-z])RM\d[\d ,.]*[.,]\d{2}\b/, 'MYR'],
  [/(?<![A-Za-z])Rp\d[\d ,.]*[.,]\d{2}\b/, 'IDR'],
  [/(?<![A-Za-z])R\d[\d ,.]*[.,]\d{2}\b/, 'ZAR'],
  // After the figure: "1 234,56 Kč".
  [/\d[.,]\d{2}\s?Kč(?!\p{L})/u, 'CZK'],
];

/** Where a bare "$" is printed, the bank's country says which dollar. */
const DOLLAR_COUNTRIES: [RegExp, string][] = [
  [/\bcanada\b|\bqu[eé]bec\b/i, 'CAD'],
  [/\baustralian?\b|\.com\.au\b/i, 'AUD'],
  [/\bnew zealand\b/i, 'NZD'],
  [/\bsingapore\b/i, 'SGD'],
  [/\bhong kong\b/i, 'HKD'],
  [/\bm[eé]xico\b/i, 'MXN'],
];

/** Statements that print no currency at all, known by a code or a country name only one currency goes with. */
const UNMARKED_COUNTRIES: [RegExp, string][] = [
  [/\bIFSC\b/, 'INR'],
  [/\b(?:PIX|CNPJ|CPF)\b/, 'BRL'],
  [/\bPhilippines\b/i, 'PHP'],
  [/\bSouth Africa\b|\.co\.za\b/i, 'ZAR'],
  // US deposit insurance: a US bank's statement that prints no "$" (#675).
  [/\bMember FDIC\b|\bFDIC[- ]insured\b/i, 'USD'],
];

/**
 * The statement currency: the ISO code printed most often (upper case only:
 * "try" and "eur" are words too; "EUROS" is EUR), else a currency symbol.
 */
export function detectStatementCurrency(text: string): string | null {
  const printed = printedCurrency(text);
  if (printed) {
    return printed;
  }
  const counts = new Map<string, number>();
  for (const match of text.matchAll(ISO_CODES)) {
    // "RELEVE DE COMPTES EN EUROS": the currency named in capitals counts as its code.
    counts.set(match[1].slice(0, 3), (counts.get(match[1].slice(0, 3)) ?? 0) + 1);
  }
  const [mostPrinted] = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  if (mostPrinted) {
    return mostPrinted[0];
  }

  const prefixed = PREFIXED_DOLLARS.find(([pattern]) => pattern.test(text));
  if (prefixed) {
    return prefixed[1];
  }
  const lettered = LETTER_SIGNS.find(([pattern]) => pattern.test(text));
  if (lettered) {
    return lettered[1];
  }
  const symbol = CURRENCY_SIGNS.find(([mark]) => text.includes(mark));
  if (symbol) {
    return symbol[1];
  }
  if (text.includes('$')) {
    return DOLLAR_COUNTRIES.find(([pattern]) => pattern.test(text))?.[1] ?? 'USD';
  }
  return UNMARKED_COUNTRIES.find(([pattern]) => pattern.test(text))?.[1] ?? null;
}

const ACCOUNT_LABEL =
  /(?:(?:account|acct\.?|conta)\s*(?:number|no\.?|#|:)|num[eé]ro\s+de\s+compte|rekeningnummer|kontonummer|n[uú]mero\s+de\s+cuenta)\s*[:.]?[ \t]*([X*\d][X*\d \t-]{3,}[X*\d])/i;
/** A Czech or Slovak number keeps its prefix and bank code: "Číslo účtu: 19-2400012345/2010". */
const CZECH_ACCOUNT_LABEL =
  /[čc][íi]slo\s+[úu][čc]tu\s*:?[ \t]*((?:\d{1,6}-)?\d{2,10}(?:\/\d{4})?)(?![\d/])/i;
// No group ends where a lower-case letter goes on: "…7890 Počáteční zůstatek" printed
// beside the number, or "…19Kontoinhaber" glued to it, is not its tail.
const IBAN_LABEL =
  /\bIBAN\s*[:.]?\s*([A-Z]{2}\d{2}(?:[ ]?[A-Z0-9]{4}(?![a-z])){2,7}(?:[ ]?[A-Z0-9]{1,3}(?![a-z]))?)/;

/** The account number as printed after its label, or the IBAN. */
export function findAccountNumber(text: string): string | null {
  const iban = text.match(IBAN_LABEL);
  if (iban) {
    return iban[1].replace(/\s+/g, '');
  }
  const labelled = text.match(CZECH_ACCOUNT_LABEL) ?? text.match(ACCOUNT_LABEL);
  return labelled ? labelled[1].replace(/[ \t]+/g, ' ').trim() : null;
}

/**
 * "09/01/2025 - 09/30/2025", "1 janvier 2025 - 31 janvier 2025", "from … to …", "From : … To : …",
 * "1 March 2023 [GMT+07:00] - 8 August 2023 [GMT+07:00]" (a time zone after each date).
 */
export function findStatementPeriod(
  text: string,
  order: NumericDateOrder,
): { from: Date; to: Date } | null {
  const folded = foldText(text);
  const dates = findFullDates(text, order);
  for (let index = 0; index + 1 < dates.length; index += 1) {
    const [from, to] = [dates[index], dates[index + 1]];
    const between = folded.slice(from.index + from.length, to.index);
    if (
      /^\s*(?:\[(?:gmt|utc)[^\]]*\]\s*)?(?:[-–—]|to|au|tot|bis|al|hasta|through)\s*:?\s*$/.test(
        between,
      ) &&
      from.date <= to.date
    ) {
      return { from: from.date, to: to.date };
    }
  }
  return null;
}

/**
 * The day the statement was drawn up, which dates printed without a year are
 * read against: the latest date it prints more than once, as the statement
 * date heads every page. The latest date of all can be years ahead ("payments
 * continue monthly until JUN 13, 2027"); it is the fallback when no date
 * repeats.
 */
export function findStatementAnchor(text: string, order: NumericDateOrder): Date | null {
  const counts = new Map<number, number>();
  for (const found of findFullDates(text, order)) {
    const time = found.date.getTime();
    counts.set(time, (counts.get(time) ?? 0) + 1);
  }
  const repeated = [...counts].filter(([, count]) => count > 1).map(([time]) => time);
  const candidates = repeated.length > 0 ? repeated : [...counts.keys()];
  return candidates.length > 0 ? new Date(Math.max(...candidates)) : null;
}

const ACCOUNT_HEADING =
  /\b(?:account|compte|rekening|konto|cuenta|a\/c)\b(?:\s+(?:number|no\.?|nr\.?|#))?\s*[:—–-]?\s*([A-Z]{2}\d{2}[A-Z0-9]{10,30}|\d[\d -]{6,}\d)/i;

/**
 * A line of only a product name and a long number ("Member Savings -
 * 3589405262"), or of a long number and its suffix in brackets, printed under
 * the product name ("100123456789 (100)").
 */
const PRODUCT_HEADING =
  /^(?:[A-Za-z][A-Za-z&' ]{2,40}?\s+[-–—]\s+(\d{8,17})|(\d{8,17}) \(\d+\)|[A-Za-z][A-Za-z&' ]{2,40}?\s+ACCT#\s*(\d{1,17}))$/;

/**
 * The heading a statement prints above one account's table ("HKD Current
 * Account — 817-890692-838", "Numéro de compte: 67324-673-9893968"): the
 * number right after the word for account, and the currency code if the line
 * names one. A line holding only a product name and a long number ("Checking
 * - 3600212596") is one too, and so is a number alone with its suffix in
 * brackets ("100123456789 (100)"), and a product name with its share number
 * ("PRIMARY SAVINGS  ACCT# 1"). Null for any other line.
 */
export function readAccountHeading(
  line: string,
): { accountNumber: string; currency?: string } | null {
  const match = line.match(ACCOUNT_HEADING) ?? line.trim().match(PRODUCT_HEADING);
  if (!match) {
    return null;
  }
  const currency = Array.from(line.matchAll(ISO_CODES), code => code[1])[0];
  return {
    accountNumber: (match[1] ?? match[2] ?? match[3]).trim(),
    ...(currency ? { currency } : {}),
  };
}
