import { findStatementAmounts } from './statement-amount.helper';

/**
 * Where the text a balance label's amount is read from ends: the label's own
 * line, or the next one when the label stands alone and its amount is printed
 * under it with its date ("Ending balance" / "on September 24, 2024 $122.45").
 * Another balance label on the same line ends it too: a summary of two columns
 * prints "Previous Balance $916.96   New Balance $203.39" as one line, and so
 * does any word after the label's figure ("… 353,060.27   Electronic Payments …").
 * `folded` is the statement folded by `foldText`; undefined means the end.
 */
export function balanceLineEnd(
  folded: string,
  index: number,
  labels: readonly string[] = [],
): number | undefined {
  const end = lineEnd(folded, index);
  const rest = folded.slice(index, end);
  const others = labels
    .map(label => new RegExp(`(?:^|[^a-z])${label}(?![a-z])`).exec(rest)?.index)
    .filter((at): at is number => at !== undefined);
  // "Beginning Balance  353,060.27   Electronic Payments  120,100.00": a word after
  // the figure starts the next column's label.
  const nextLabel = NEXT_COLUMN_LABEL.exec(rest);
  const cuts = [...others, ...(nextLabel ? [nextLabel.index + nextLabel[1].length] : [])];
  return cuts.length > 0 ? index + Math.min(...cuts) : end;
}

/** A figure, then a word of three letters or more: another column's label begins. */
const NEXT_COLUMN_LABEL = /(\d[.,]\d{2}\s+)(?=[a-z]{3,}(?!\s*[:.]?\s*$))/;

function lineEnd(folded: string, index: number): number | undefined {
  const end = folded.indexOf('\n', index);
  if (end === -1) {
    return undefined;
  }
  if (
    folded.slice(index, end).trim() !== '' ||
    !/^[ \t]*(?:on|as of|as at)\s/.test(folded.slice(end + 1))
  ) {
    return end;
  }
  const next = folded.indexOf('\n', end + 1);
  return next === -1 ? undefined : next;
}

/** A date in any order ("29.03.2018" on a month-first statement): never an amount. */
const DATE_SHAPE = /\b\d{1,2}([./-])\d{1,2}\1\d{2,4}\b/g;

/** A line's amounts, its dates left out whatever their order. */
export function amountsWithoutDates(line: string): number[] {
  return findStatementAmounts(line.replace(DATE_SHAPE, ' '));
}

/**
 * The figure of a label that ends a row of box headings, printed under it:
 * "Statement Page  IBAN  BIC  Previous balance as at 29.03.2018" over
 * "5  1/7  DE48 …  EUR +12,898.29", or "Branch number  Account number  New
 * balance" over the account number and then "EUR +15,509.61". Only a label
 * after other headings, with nothing after it but its date, reads the two
 * lines under it: the last figure of the first one that has any. A label
 * alone on its line heads a dated row, whose balance is no figure of its.
 */
export function figureUnderLabel(
  text: string,
  folded: string,
  label: { start: number; end: number },
): number | null {
  const end = folded.indexOf('\n', label.end);
  const start = folded.lastIndexOf('\n', label.start) + 1;
  const rest = folded.slice(label.end, end === -1 ? undefined : end).replace(DATE_SHAPE, ' ');
  const headings = folded.slice(start, label.start).trim();
  if (end === -1 || !headings || !/^\s*(?:(?:as (?:at|of)|on)\s*)?:?\s*$/.test(rest)) {
    return null;
  }
  const below = text
    .slice(end + 1)
    .split('\n')
    .slice(0, 2);
  for (const line of below) {
    if (/^\s*\d{1,4}[./-]\d{1,2}\b/.test(line)) {
      // A dated line under it is the table's first row, not the label's figure.
      return null;
    }
    const amounts = amountsWithoutDates(line);
    if (amounts.length > 0) {
      return amounts[amounts.length - 1];
    }
  }
  return null;
}
