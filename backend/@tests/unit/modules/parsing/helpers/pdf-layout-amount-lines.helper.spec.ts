import type { PdfTextRow } from '@/common/utils/pdf-parser.util';
import { joinAmountLines } from '@/modules/parsing/helpers/pdf-layout-amount-lines.helper';

const row = (y: number, words: [string, number][]): PdfTextRow => ({
  page: 1,
  y,
  text: words.map(([text]) => text).join(' '),
  items: words.map(([text, x]) => ({ text, x, y, width: text.length * 5, height: 8, page: 1 })),
});

describe('joinAmountLines', () => {
  it('joins a line of amounts alone to the text line right above it', () => {
    const rows = joinAmountLines([
      row(100, [['7', 49], ['Dec', 56], ['2022', 75], ['Transfer', 104], ['to', 150]]),
      row(111, [['150.00', 370], ['26,389.01', 500], ['Cr', 543]]),
      row(122, [['Transfer', 104], ['to', 150]]),
      row(133, [['20.00', 375]]),
    ]);
    expect(rows.map(line => line.text)).toEqual([
      '7 Dec 2022 Transfer to 150.00 26,389.01 Cr',
      'Transfer to 20.00',
    ]);
    expect(rows[1].items.every(item => item.y === 122)).toBe(true);
  });

  it('leaves amounts that do not start right of the text, or sit far below, on their own', () => {
    const rows = joinAmountLines([
      row(100, [['Transfer', 104], ['to', 150]]),
      row(140, [['20.00', 375]]),
      row(151, [['Wide', 104], ['text', 300], ['here', 390]]),
      row(162, [['30.00', 375]]),
    ]);
    expect(rows).toHaveLength(4);
  });
});
