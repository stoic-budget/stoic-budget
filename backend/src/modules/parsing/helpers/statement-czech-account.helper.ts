/**
 * A Czech or Slovak domestic account number: an optional prefix, the number
 * and the bank's four-digit code after a slash ("2900000001/0800",
 * "19-1234567890/0100", "5500000001 / 0100" spaced), or an IBAN. The number
 * has five digits or more: "12/2026" is a month.
 */
const DOMESTIC = /(?<![\d/-])((?:\d{1,6}-)?\d{5,10})\s?\/\s?(\d{4})(?![\d/])/;
/** Its last group ends at a word's end: "SK89…5671 Bývanie" leaves the category's letter. */
const IBAN = /\b([A-Z]{2}\d{2}(?: ?[A-Z0-9]{4}){3,7}(?: ?[A-Z0-9]{1,4})?)(?![\p{L}\p{N}])/u;

/** The account number printed in the text, without spaces; null when there is none. */
export function findCzechAccount(text: string): string | null {
  const domestic = text.match(DOMESTIC);
  if (domestic) {
    return `${domestic[1]}/${domestic[2]}`;
  }
  const iban = text.match(IBAN);
  return iban ? iban[1].replace(/ /g, '') : null;
}

/** The text without the account number in it. */
export function withoutCzechAccount(text: string): string {
  return text.replace(DOMESTIC, ' ').replace(IBAN, ' ').replace(/\s+/g, ' ').trim();
}

const SYMBOL = /\b(VS|KS|SS)\s*[:.]?\s*(\d{1,10})\b/g;

/**
 * The payment symbols printed with a Czech payment ("VS: 2026030 KS: 0308"):
 * the variable symbol is the payment's reference, the constant and specific
 * ones say what kind of payment it is.
 */
export function readPaymentSymbols(text: string): { vs?: string; ks?: string; ss?: string } {
  const symbols: { vs?: string; ks?: string; ss?: string } = {};
  for (const match of text.matchAll(SYMBOL)) {
    const key = match[1].toLowerCase() as 'vs' | 'ks' | 'ss';
    symbols[key] ??= match[2];
  }
  return symbols;
}

/**
 * "Měna účtu CZK" (Fio), "Mena účtu: EUR" (Slovak), "Měna: CZK" (ČSOB): the
 * account's currency, on a header line of its own; "Platba kartou Měna USD"
 * in a row is a payment's.
 */
const ACCOUNT_CURRENCY = /^[ \t]*M[eě]na(?:\s+(?:účtu|uctu))?[ \t]*:?[ \t]*([A-Z]{3})\b/mu;

/** The currency the statement's header names for the account, or null. */
export function findAccountCurrency(text: string): string | null {
  return text.match(ACCOUNT_CURRENCY)?.[1] ?? null;
}

/** A line starting with a date: the first row of the table, past the header. */
const DATED_LINE = /^\s*\d{1,2}\.\s?\d{1,2}\.\s?\d{4}\b|^\s*\d{4}-\d{2}-\d{2}\b/;

/**
 * The statement's header: its first lines up to the first one starting with
 * a date (a row), at most `max`. What a bank prints there names the statement;
 * a row's lines under it (a payment to that bank's account) do not.
 */
export function headerLines(text: string, max = 20): string {
  const lines = text.normalize('NFC').split('\n').slice(0, max);
  const firstRow = lines.findIndex(line => DATED_LINE.test(line));
  return (firstRow === -1 ? lines : lines.slice(0, firstRow)).join('\n');
}
