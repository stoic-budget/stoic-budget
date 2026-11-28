import type { PdfTextRow } from '../../../common/utils/pdf-parser.util';
import type { LayoutTransaction } from './pdf-layout-table.helper';
import { isNextLine } from './pdf-layout-wrapped.helper';
import { parseDateParts } from './statement-date.helper';

export const byPosition = (a: { page: number; y: number }, b: { page: number; y: number }) =>
  a.page - b.page || a.y - b.y;

/**
 * The lines each row was read from: its first line and those set close under
 * it, up to the first gap or the next row. A footer at the foot of the page,
 * or a note printed after the table, is no part of the row above it; a row
 * read without its position gets no lines.
 */
export function rowBlocks(rows: PdfTextRow[], read: LayoutTransaction[]): PdfTextRow[][] {
  const lines = [...rows].sort(byPosition);
  return read.map((transaction, index) => {
    const start = transaction.at;
    const end = read.slice(index + 1).find(next => next.at)?.at;
    if (!start) {
      return [];
    }
    const block: PdfTextRow[] = [];
    for (const line of lines) {
      if (byPosition(line, start) < 0) {
        continue;
      }
      const last = block[block.length - 1];
      if ((end && byPosition(line, end) >= 0) || (last && !isNextLine(line, last))) {
        break;
      }
      block.push(line);
    }
    return block;
  });
}

/** A line read as one word, so a figure on it is text, not money ("3,00 EUR;ACME FUEL 731"). */
export function asTextRow(row: PdfTextRow): PdfTextRow {
  const items = [...row.items].sort((a, b) => a.x - b.x);
  const [first] = items;
  if (!first) {
    return row;
  }
  const end = items.reduce((right, item) => Math.max(right, item.x + item.width), first.x);
  return { ...row, items: [{ ...first, text: row.text, width: end - first.x }] };
}

/** The words a line starts with that make a date ("3. 3. 2026" is three), or 0. */
export function leadingDateWords(row: PdfTextRow): number {
  const words = [...row.items].sort((a, b) => a.x - b.x).map(item => item.text);
  for (let count = Math.min(3, words.length); count >= 1; count -= 1) {
    if (parseDateParts(words.slice(0, count).join(' '), 'dmy')) {
      return count;
    }
  }
  return 0;
}

export interface BlockReading {
  /** The rows, the lines under each block's first line made text in the first line's text column. */
  lines: PdfTextRow[];
  /** The lines of each row read from `lines`, its first line first. */
  blocks: (read: LayoutTransaction[]) => PdfTextRow[][];
}

const positionKey = (at: { page: number; y: number }) => `${at.page}:${at.y}`;

/**
 * For a table whose rows are blocks and only a block's first line holds money
 * (Raiffeisenbank): the lines set close under a first line become text in the
 * column the first line's text starts in, so their figures (an original
 * amount, a rate, a card's detail) are no money of the account and a value
 * date they start with heads no row of its own. A block cut by a page break
 * goes on after the next page's header; `isPageHeader` tells the lines of
 * a page's header and footer, which neither end a block nor join it.
 */
export function readBlocks(
  rows: PdfTextRow[],
  isFirstLine: (row: PdfTextRow) => boolean,
  isPageHeader: (row: PdfTextRow) => boolean = () => false,
): BlockReading {
  const ordered = [...rows].sort(byPosition);
  const byFirst = new Map<string, PdfTextRow[]>();
  let block: PdfTextRow[] | null = null;
  let last: PdfTextRow | null = null;
  let textX = 0;
  const lines = ordered.map(row => {
    if (isFirstLine(row)) {
      block = [row];
      byFirst.set(positionKey(row), block);
      last = row;
      const words = [...row.items].sort((a, b) => a.x - b.x);
      textX = words[leadingDateWords(row)]?.x ?? words[0]?.x ?? 0;
      return row;
    }
    if (!(block && last) || isPageHeader(row)) {
      return row;
    }
    // Under the first line, or the first line of a later page past its header.
    const continues = row.page === last.page ? isNextLine(row, last) : row.page === last.page + 1;
    if (!continues) {
      block = null;
      return row;
    }
    const [text] = asTextRow(row).items;
    const line = text ? { ...row, items: [{ ...text, x: Math.max(text.x, textX) }] } : row;
    block.push(line);
    last = line;
    return line;
  });
  return {
    lines,
    blocks: read =>
      read.map(transaction =>
        transaction.at ? (byFirst.get(positionKey(transaction.at)) ?? []) : [],
      ),
  };
}
