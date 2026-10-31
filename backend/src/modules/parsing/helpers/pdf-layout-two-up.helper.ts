import type { PdfTextItem, PdfTextRow } from '../../../common/utils/pdf-parser.util';
import type { LayoutColumn } from './pdf-layout-columns.helper';
import { rowHeight } from './pdf-layout-wrapped.helper';

/**
 * A short table printed in two blocks side by side to save paper: "Date
 * Serial # Amount Date Serial # Amount" over checks listed two to a line. Its
 * header is the same columns twice; each line under it is two rows, and the
 * right one is read as if it stood in the left block.
 */

/** Lines this many line heights apart are not one table. */
const TABLE_GAP_HEIGHTS = 2.6;

/** The block the header repeats: where the second one starts, and how far right it sits. */
export function twoUpBlock(header: LayoutColumn[]): { at: number; shift: number } | null {
  const half = header.length / 2;
  if (!Number.isInteger(half) || half < 2) {
    return null;
  }
  const repeats = header.slice(0, half).every((column, index) => {
    const twin = header[half + index];
    return twin.role === column.role && twin.heading === column.heading;
  });
  const [first, second] = [header[0], header[half]];
  // Between the first block's last column and the second block's first.
  const at = (header[half - 1].x1 + second.x0) / 2;
  return repeats ? { at, shift: second.x0 - first.x0 } : null;
}

const asRow = (row: PdfTextRow, items: PdfTextItem[]): PdfTextRow => ({
  ...row,
  items,
  text: items.map(item => item.text).join(' '),
});

/**
 * Rows in page order with every line under a two-block header (up to the first
 * gap or page change) split in two, the right block moved left. The header
 * itself stays as it is: its columns twice.
 */
export function splitTwoUp(
  rows: PdfTextRow[],
  readHeader: (row: PdfTextRow) => LayoutColumn[] | null,
): PdfTextRow[] {
  const result: PdfTextRow[] = [];
  let block: { at: number; shift: number } | null = null;
  let last: PdfTextRow | null = null;
  for (const row of rows) {
    const header = readHeader(row);
    const apart =
      last === null ||
      last.page !== row.page ||
      row.y - last.y > TABLE_GAP_HEIGHTS * rowHeight(last);
    last = row;
    block = header ? twoUpBlock(header) : apart ? null : block;
    if (!block) {
      result.push(row);
      continue;
    }
    if (header) {
      result.push(row);
      continue;
    }
    const { at, shift } = block;
    const right = row.items.filter(item => item.x >= at);
    result.push(
      asRow(
        row,
        row.items.filter(item => item.x < at),
      ),
    );
    if (right.length > 0) {
      result.push(
        asRow(
          row,
          right.map(item => ({ ...item, x: item.x - shift })),
        ),
      );
    }
  }
  return result;
}
