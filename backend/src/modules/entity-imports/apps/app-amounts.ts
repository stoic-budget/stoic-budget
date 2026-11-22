import { type DateOrder, detectDateOrder, parseImportDate } from '../helpers/import-values';

/** Which mark separates the cents: `1,234.56` or `1.234,56`. */
export type DecimalMark = '.' | ',';

const DIGITS_AND_MARKS = /[^\d.,]/g;

/**
 * The decimal mark a column of amounts uses. A value ending in a mark and one
 * or two digits votes for that mark (`12,50`, `€1.234,56`); three digits after
 * the last mark (`¥1,234`) say nothing. Without votes the fallback stands.
 */
export function detectDecimalMark(values: string[], fallback: DecimalMark): DecimalMark {
  let dot = 0;
  let comma = 0;
  for (const value of values) {
    const cleaned = String(value ?? '').replace(DIGITS_AND_MARKS, '');
    const match = /([.,])\d{1,2}$/.exec(cleaned);
    if (match?.[1] === '.') {
      dot += 1;
    } else if (match?.[1] === ',') {
      comma += 1;
    }
  }
  if (dot === comma) {
    return fallback;
  }
  return dot > comma ? '.' : ',';
}

/**
 * An amount as an app wrote it: any currency sign before or after, grouping
 * marks, a minus (ASCII or U+2212) or parentheses for money out. Null when
 * there is no number.
 */
export function parseAppAmount(raw: string, mark: DecimalMark): number | null {
  const text = String(raw ?? '').trim();
  if (!/\d/.test(text)) {
    return null;
  }
  const negative = /^\(.*\)$/.test(text) || /[-−]/.test(text);
  const digits = text.replace(DIGITS_AND_MARKS, '');
  const plain =
    mark === '.' ? digits.replace(/,/g, '') : digits.replace(/\./g, '').replace(',', '.');
  const value = Number(plain);
  if (!Number.isFinite(value)) {
    return null;
  }
  // Cents, not float noise: 0.1 + 0.2 must not reach a decimal(15,2) column as 0.30000000000000004.
  const rounded = Math.round(value * 100) / 100;
  return negative ? -rounded : rounded;
}

/**
 * The dates of one column as ISO. The order of day and month is read from the
 * column; when every value reads both ways, a slash means month first (the US
 * default the apps ship with) and a dot or dash day first.
 */
export function readDateColumn(values: string[]): Array<string | null> {
  const detected = detectDateOrder(values);
  const sample = values.find(value => /^\d{1,2}[./-]\d{1,2}[./-]\d{2,4}/.test(value.trim()));
  const order: DateOrder | null =
    detected ?? (sample ? (sample.includes('/') ? 'mdy' : 'dmy') : null);
  return values.map(value => parseImportDate(value, order));
}

/** A cell an app escaped against spreadsheet formulas (`'-Shop` → `-Shop`). */
export const unescapeFormula = (value: string): string =>
  /^'[=+\-@\t\r]/.test(value) ? value.slice(1) : value;
