import type { PdfTextItem, PdfTextRow } from '../../../common/utils/pdf-parser.util';
import { leadingDate } from './pdf-layout-row-date.helper';

/** Whether a date starts at the word `at` of a line's words, left to right ("02 Sep"). */
export const opensDate = (items: PdfTextItem[], at: number) =>
  at >= 0 && leadingDate(items.slice(at)) !== null;

/**
 * A transaction row of a statement being taught: its first words are a date
 * ("02 Sep"), or the first words under a marked date column are ("ACME Store
 * 02 Sep  12.50"), as the reader takes a date printed right of the text.
 */
export function datedRow(row: PdfTextRow, dates: readonly { x0: number; x1: number }[]): boolean {
  const items = [...row.items].sort((a, b) => a.x - b.x);
  return (
    opensDate(items, 0) ||
    dates.some(date =>
      opensDate(
        items,
        items.findIndex(item => item.x + item.width > date.x0 && item.x < date.x1),
      ),
    )
  );
}
