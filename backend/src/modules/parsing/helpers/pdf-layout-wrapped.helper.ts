import type { PdfTextRow } from '../../../common/utils/pdf-parser.util';
import type { LaidOutRow } from './pdf-layout-columns.helper';
import { findStatementAmounts } from './statement-amount.helper';
import { isBalanceLabel } from './statement-metadata.helper';

/**
 * Lines this close, in line heights, belong to one table row: a cell's text
 * wrapped around the amounts printed at its middle, each line overlapping the
 * next ("ANZ INTERNET BANKING TRANSFER" / "07 FEB 1,266.66 12,819.24" /
 * "WAGES ..."; Banco do Brasil prints the amount 0.8 of a line under its row).
 * Separate rows sit a line height apart or more; a footer laid
 * over a row is only a fraction of a point off and stays apart too.
 */
const WRAPPED_GAP_MIN = 0.3;
const WRAPPED_GAP_MAX = 0.9;

export function rowHeight(row: PdfTextRow): number {
  return Math.max(...row.items.map(item => item.height), 1);
}

/** Rows in page order, grouped into the printed lines of one table row each. */
export function groupWrappedLines(rows: PdfTextRow[]): PdfTextRow[][] {
  const groups: PdfTextRow[][] = [];
  for (const row of rows) {
    const group = groups[groups.length - 1];
    const last = group?.[group.length - 1];
    const gap = last?.page === row.page ? (row.y - last.y) / rowHeight(last) : null;
    if (group && gap !== null && gap > WRAPPED_GAP_MIN && gap < WRAPPED_GAP_MAX) {
      group.push(row);
    } else {
      groups.push([row]);
    }
  }
  return groups;
}

/** The words of a row's lines together: text in line order, amounts from whichever line holds them. */
export function mergeLaidOut(lines: LaidOutRow[]): LaidOutRow {
  const merged: LaidOutRow = { text: {}, amounts: [] };
  for (const line of lines) {
    merged.amounts.push(...line.amounts);
    for (const [role, words] of Object.entries(line.text) as [
      keyof LaidOutRow['text'],
      string[],
    ][]) {
      merged.text[role] = [...(merged.text[role] ?? []), ...words];
    }
  }
  return merged;
}

/**
 * Words that overlap on the page cannot share a printed line: a footer laid
 * over the last row ends up in the same extracted row a fraction of a point
 * higher. Such a row splits by each word's top; any other row stays whole.
 */
export function splitOverlappingLines(row: PdfTextRow): PdfTextRow[] {
  const items = [...row.items].sort((a, b) => a.x - b.x);
  const overlaps = items.some((item, index) =>
    items
      .slice(index + 1)
      .some(other => other.x < item.x + item.width && Math.abs(other.y - item.y) > 0.3),
  );
  if (!overlaps) {
    return [row];
  }
  const lines: PdfTextRow[] = [];
  for (const item of [...items].sort((a, b) => a.y - b.y)) {
    const line = lines.find(candidate => Math.abs(candidate.y - item.y) <= 0.3);
    if (line) {
      line.items.push(item);
    } else {
      lines.push({ ...row, y: item.y, items: [item] });
    }
  }
  return lines;
}

/** "(continued on next page)" under the last row of a page is a note to the reader, no text of the row. */
const PAGE_NOTE = /^\(?continued(?: on (?:the )?next page)?\)?$/i;

/** A line further than this many line heights below the previous one is not a continuation. */
const CONTINUATION_LINE_HEIGHTS = 2.6;

/**
 * Whether a line without its own date adds to the transaction above it: it
 * sits right under the previous line, carries no money (money anywhere makes
 * it a totals line or a note such as "Frais sur compte: 23,00 $"; the row's
 * own balance repeated does not count) and keeps out of the date column,
 * which a footer does not.
 */
export function isNextLine(row: PdfTextRow, lastRow: PdfTextRow | null): boolean {
  return (
    lastRow !== null &&
    lastRow.page === row.page &&
    row.y - lastRow.y <= CONTINUATION_LINE_HEIGHTS * rowHeight(lastRow)
  );
}

export function continuesTransaction(
  row: PdfTextRow,
  laidOut: LaidOutRow,
  lastRow: PdfTextRow | null,
  balance?: number,
) {
  // The row's balance printed again on its wrapped line is not new money.
  const isMoney = (value: number) => value !== 0 && Math.abs(value) !== Math.abs(balance ?? NaN);
  const hasMoney =
    laidOut.amounts.some(amount => isMoney(amount.value)) ||
    findStatementAmounts(row.items.map(item => item.text).join(' ')).some(isMoney);
  const reachesDateColumn = (laidOut.text.date ?? []).length > 0;
  // "Ending Balance $12,274.35" under the last row states the balance, it is no text of the row.
  return (
    isNextLine(row, lastRow) &&
    !hasMoney &&
    !reachesDateColumn &&
    !isBalanceLabel(row.text) &&
    !PAGE_NOTE.test(row.text.trim())
  );
}
