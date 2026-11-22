import type { PdfTextRow } from '../../../common/utils/pdf-parser.util';
import { isAmountPart, parseStatementAmount } from './statement-amount.helper';

/** The amounts' line sits right under its text, closer than this many points. */
const LINE_GAP = 14;

const isMoney = (text: string) => isAmountPart(text) || /^(?:CR|DR)$/i.test(text);

/**
 * Rows whose text and money are printed on two lines: the particulars, then
 * a dot leader out to the amount and balance on the line below ("Internet
 * Transfer" over "..........20.00   25,687.01 Cr"). Each line of amounts
 * alone joins the text line right above it, when it starts right of that
 * line's text. A bank whose statements print rows this way reads them
 * through this before the table reader.
 */
export function joinAmountLines(rows: PdfTextRow[]): PdfTextRow[] {
  const ordered = [...rows].sort((a, b) => a.page - b.page || a.y - b.y);
  const out: PdfTextRow[] = [];
  for (const row of ordered) {
    const above = out.at(-1);
    const amountsOnly = row.items.length > 0 && row.items.every(item => isMoney(item.text));
    // A date's day and year are no money: only a figure with its decimals is.
    const textOnly = above?.items.every(item => parseStatementAmount(item.text) === null);
    const rightOf =
      above &&
      Math.min(...row.items.map(item => item.x)) >
        Math.max(...above.items.map(item => item.x + item.width));
    if (
      above &&
      amountsOnly &&
      textOnly &&
      rightOf &&
      above.page === row.page &&
      row.y - above.y <= LINE_GAP
    ) {
      const items = [...above.items, ...row.items.map(item => ({ ...item, y: above.y }))];
      out[out.length - 1] = { ...above, items, text: items.map(item => item.text).join(' ') };
      continue;
    }
    out.push(row);
  }
  return out;
}
