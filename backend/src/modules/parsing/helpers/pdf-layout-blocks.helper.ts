import type { PdfTextRow } from '../../../common/utils/pdf-parser.util';
import type { LayoutTransaction } from './pdf-layout-table.helper';
import { isNextLine } from './pdf-layout-wrapped.helper';

const byPosition = (a: { page: number; y: number }, b: { page: number; y: number }) =>
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
