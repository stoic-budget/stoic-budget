import type { PdfTextRow } from '@/common/utils/pdf-parser.util';
import { withoutStackedDates } from '@/modules/parsing/helpers/pdf-layout-stacked-dates.helper';

/** A line of words at the given x positions, 10pt apart from the line above. */
function line(y: number, words: [number, string][]): PdfTextRow {
  return {
    page: 1,
    y,
    text: words.map(([, text]) => text).join(' '),
    items: words.map(([x, text]) => ({ text, x, y, width: text.length * 4, height: 8, page: 1 })),
  };
}

const STACKED_HEADER = [
  line(100, [[40, 'Datum'], [63, 'zaúčtování'], [160, 'Operace'], [520, 'Částka']]),
  line(110, [[40, 'Datum'], [63, 'transakce'], [160, 'Popis']]),
];

describe('withoutStackedDates', () => {
  it("takes the payment's date off the line under the booking date", () => {
    const rows = withoutStackedDates([
      ...STACKED_HEADER,
      line(130, [[40, '2.3.2026'], [160, 'Platba'], [190, 'kartou'], [520, '-245,90']]),
      line(140, [[40, '1.3.2026'], [160, 'Nákup:'], [190, 'ACME']]),
      line(150, [[40, '3.3.2026'], [160, 'Platba'], [190, 'kartou'], [520, '-12,00']]),
    ]);
    expect(rows.map(row => row.text)).toEqual([
      'Datum zaúčtování Operace Částka',
      'Datum transakce Popis',
      '2.3.2026 Platba kartou -245,90',
      'Nákup: ACME',
      '3.3.2026 Platba kartou -12,00',
    ]);
  });

  it('takes off a lower date printed as three words, "28. 2. 2026"', () => {
    const rows = withoutStackedDates([
      ...STACKED_HEADER,
      line(130, [[40, '2.'], [50, '3.'], [60, '2026'], [160, 'Příchozí'], [520, '2 500,00']]),
      line(140, [[40, '28.'], [52, '2.'], [62, '2026'], [160, 'Faktura'], [192, '2026-014']]),
    ]);
    expect(rows.at(-1)?.text).toBe('Faktura 2026-014');
  });

  it('leaves out a line that holds only the lower date', () => {
    const rows = withoutStackedDates([
      ...STACKED_HEADER,
      line(130, [[40, '28.2.2026'], [160, 'Úhrada'], [520, '-150,00']]),
      line(140, [[40, '28.2.2026']]),
      line(150, [[160, 'ACME Energie a.s.']]),
    ]);
    expect(rows.map(row => row.text)).toEqual([
      'Datum zaúčtování Operace Částka',
      'Datum transakce Popis',
      '28.2.2026 Úhrada -150,00',
      'ACME Energie a.s.',
    ]);
  });

  it('stops at the next table, whose header prints one date', () => {
    const later = [
      { ...line(100, [[40, 'Date'], [160, 'Description'], [520, 'Amount']]), page: 2 },
      { ...line(130, [[40, '3.3.2026'], [160, 'Card'], [520, '-1,00']]), page: 2 },
      // Newest first: an earlier date under a row heads a row of its own here.
      { ...line(140, [[40, '2.3.2026'], [160, 'Wrapped'], [190, 'row']]), page: 2 },
      { ...line(150, [[160, 'tail'], [520, '-2,00']]), page: 2 },
    ];
    const rows = withoutStackedDates([
      ...STACKED_HEADER,
      line(130, [[40, '2.3.2026'], [160, 'Platba'], [520, '-245,90']]),
      ...later,
    ]);
    expect(rows.slice(-3).map(row => row.text)).toEqual(['3.3.2026 Card -1,00', '2.3.2026 Wrapped row', 'tail -2,00']);
  });

  it('reads no value date as a payment date: it can come after the booking', () => {
    const input = [
      line(100, [[40, 'Datum'], [63, 'zaúčtování'], [160, 'Operace'], [520, 'Částka']]),
      line(110, [[40, 'Valuta'], [160, 'Popis']]),
      line(130, [[40, '11.2.2024'], [160, 'ACME'], [520, '20,00']]),
      line(140, [[40, '12.2.2024'], [160, 'TRANSFER']]),
      line(150, [[160, 'REF'], [520, '500,00']]),
    ];
    expect(withoutStackedDates(input)).toEqual(input);
  });

  it('keeps a later dated line as a row of its own', () => {
    const rows = withoutStackedDates([
      ...STACKED_HEADER,
      line(130, [[40, '11.2.2024'], [160, 'ACME'], [520, '20,00']]),
      line(140, [[40, '12.2.2024'], [160, 'TRANSFER']]),
    ]);
    expect(rows.at(-1)?.text).toBe('12.2.2024 TRANSFER');
  });

  it('takes no date off a line that is not right under a row with money', () => {
    const rows = withoutStackedDates([
      ...STACKED_HEADER,
      line(130, [[40, '2.3.2026'], [160, 'Platba']]),
      line(140, [[40, '1.3.2026'], [160, 'Nákup']]),
      line(150, [[40, '3.3.2026'], [160, 'Platba'], [520, '-1,00']]),
      line(190, [[40, '2.3.2026'], [160, 'Nákup']]),
    ]);
    expect(rows.slice(2).map(row => row.text)).toEqual([
      '2.3.2026 Platba',
      '1.3.2026 Nákup',
      '3.3.2026 Platba -1,00',
      '2.3.2026 Nákup',
    ]);
  });

  it('keeps a dated line without money where the header prints one date', () => {
    const input = [
      line(100, [[40, 'Date'], [160, 'Description'], [520, 'Amount']]),
      line(130, [[40, '11/02'], [160, 'ACME'], [520, '20.00']]),
      // "12 FEB ANZ ATM" over "GRIFFITH BRANCH 500.00": the date heads the next row.
      line(140, [[40, '12/02'], [160, 'ATM']]),
      line(150, [[160, 'BRANCH'], [520, '500.00']]),
    ];
    expect(withoutStackedDates(input)).toEqual(input);
  });
});
