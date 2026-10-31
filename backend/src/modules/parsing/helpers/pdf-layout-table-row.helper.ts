import type { PdfTextItem, PdfTextRow } from '../../../common/utils/pdf-parser.util';
import { type LayoutColumn, layOutRow } from './pdf-layout-columns.helper';
import { leadingDate, startsLeftOfText } from './pdf-layout-row-date.helper';

/** A word's slack, in points, when it is placed against a column's edge. */
const COLUMN_SLACK = 4;

/**
 * The words of a row without its number: a "No." column left of the date
 * ("1 ." before "26.10.2021") numbers the rows and is no text of any.
 */
function withoutRowNumber(items: PdfTextItem[], columns: LayoutColumn[]): PdfTextItem[] {
  const date = columns.find(column => column.role === 'date');
  const number = columns.find(column => column.role === 'other' && column.x0 < (date?.x0 ?? 0));
  if (!(date && number)) {
    return items;
  }
  return items.filter(
    item => item.x < number.x0 - COLUMN_SLACK || item.x >= date.x0 - COLUMN_SLACK,
  );
}

/** A row's leading date, if any, and the rest of its words by column. */
export function readTableRow(row: PdfTextRow, columns: LayoutColumn[]) {
  const items = withoutRowNumber(
    [...row.items].sort((a, b) => a.x - b.x),
    columns,
  );
  const found = leadingDate(items);
  // A date in the description column ("03/07 07:50 …", "On" wrapped onto
  // "07 Sep") opens no row; it is left out of the text all the same.
  const date = found && startsLeftOfText(items[0], columns) ? found : null;
  return { date, laidOut: layOutRow(found ? items.slice(found.used) : items, columns) };
}
