import type { PdfTextRow } from '../../../common/utils/pdf-parser.util';

/**
 * A line of the one word "End" closes the statement's table: what follows it
 * on that page ("Transactions not yet processed", with a header of its own)
 * is not part of the account's movements. Rows are in page order.
 */
export function withoutRowsAfterEnd(rows: PdfTextRow[]): PdfTextRow[] {
  const ended = new Set<number>();
  return rows.filter(row => {
    if (ended.has(row.page)) {
      return false;
    }
    if (/^end$/i.test(row.text.trim())) {
      ended.add(row.page);
    }
    return true;
  });
}
