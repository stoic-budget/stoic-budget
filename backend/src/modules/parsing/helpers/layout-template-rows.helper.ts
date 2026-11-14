import type { PdfTextItem, PdfTextRow } from '../../../common/utils/pdf-parser.util';
import { leadingDate } from './pdf-layout-row-date.helper';

/** Whether a date starts at the word `at` of a line's words, left to right ("02 Sep"). */
export const opensDate = (items: PdfTextItem[], at: number) =>
  at >= 0 && leadingDate(items.slice(at)) !== null;

interface MarkedArea {
  tag: string;
  page: number;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** Whether a word of the line has its middle inside the area. */
const crosses = (row: PdfTextRow, area: MarkedArea) =>
  row.page === area.page &&
  row.items.some(item => {
    const x = item.x + item.width / 2;
    const y = item.y + item.height / 2;
    return x >= area.x0 && x <= area.x1 && y >= area.y0 && y <= area.y1;
  });

/**
 * A transaction row of a statement being taught: its first words are a date
 * ("02 Sep"), or, on a line a Date area covers and that area lies right of a
 * marked description ("ACME Store  02 Sep  12.50"), the first words under that
 * area are, as the reader takes a date printed right of the text
 * (`dateRightOfText`).
 */
export function datedRow(row: PdfTextRow, marked: readonly MarkedArea[]): boolean {
  const items = [...row.items].sort((a, b) => a.x - b.x);
  const texts = marked.filter(area => area.tag === 'description');
  return (
    opensDate(items, 0) ||
    marked.some(
      date =>
        date.tag === 'date' &&
        texts.some(text => date.x0 > text.x0) &&
        crosses(row, date) &&
        opensDate(
          items,
          items.findIndex(item => item.x + item.width > date.x0 && item.x < date.x1),
        ),
    )
  );
}
