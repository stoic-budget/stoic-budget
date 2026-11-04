import type { PdfTextRow } from '@/common/utils/pdf-parser.util';
import { readLayoutTransactions } from '@/modules/parsing/helpers/pdf-layout-table.helper';

/** A word is [text, x]; width is 5pt per character, height 6pt. */
type Word = [string, number];

const row = (y: number, words: Word[]): PdfTextRow => ({
  page: 1,
  y,
  text: words.map(([text]) => text).join(' '),
  items: words.map(([text, x]) => ({ text, x, y, width: text.length * 5, height: 6, page: 1 })),
});

describe('pdf-layout-stacked-header.helper', () => {
  it('reads a header whose headings wrap onto a second line', () => {
    const rows = readLayoutTransactions([
      // "Money out of" / "your account ($)" ends at 400, "Money into" / … at 515.
      row(100, [['Money', 330], ['out', 360], ['of', 380], ['Money', 445], ['into', 475]]),
      row(106, [
        ['Date', 85],
        ['Description', 130],
        ['your', 325],
        ['account', 347],
        ['($)', 385],
        ['your', 440],
        ['account', 462],
        ['($)', 500],
        ['Balance', 540],
        ['($)', 580],
      ]),
      row(120, [['Aug', 85], ['8', 101], ['ACME', 130], ['Store', 155], ['$8.88', 375], ['1,950.31', 555]]),
      row(136, [['Aug', 85], ['9', 101], ['Deposit', 130], ['$300.00', 480], ['2,250.31', 555]]),
      // OCR lost the decimal point: no amount, and not part of the text either.
      row(152, [['Aug', 85], ['9', 101], ['Withdrawal', 130], ['$200.00', 365], ['205031', 565]]),
    ]);
    expect(rows.map(t => [t.dateText, t.description, t.debit, t.credit, t.balance])).toEqual([
      ['Aug 8', 'ACME Store', 8.88, undefined, 1950.31],
      ['Aug 9', 'Deposit', undefined, 300, 2250.31],
      ['Aug 9', 'Withdrawal', 200, undefined, undefined],
    ]);
  });

  it('keeps the lower line alone when joining would lose one of its columns, and skips the value date', () => {
    const rows = readLayoutTransactions([
      // A tick-box mark over the right edge of "Crédit" would glue onto it.
      row(100, [['Date', 20], ['Date', 50], ['þ', 551]]),
      row(104, [['Libellé', 80], ['des', 115], ['opérations', 135], ['Débit', 435], ['Crédit', 519]]),
      row(108, [['opé.', 20], ['valeur', 48]]),
      row(130, [['16.12', 18], ['16.12', 50], ['Avoir', 80], ['ACME', 110], ['7,44', 529]]),
      row(145, [['20.12', 18], ['20.12', 50], ['Carte', 80], ['ACME', 110], ['12,99', 435]]),
    ]);
    expect(rows.map(t => [t.dateText, t.description, t.debit, t.credit])).toEqual([
      ['16.12', 'Avoir ACME', undefined, 7.44],
      ['20.12', 'Carte ACME', 12.99, undefined],
    ]);
  });

  it('reads an amount set left of the text as money, even when it reads as a date too', () => {
    const rows = readLayoutTransactions([
      row(100, [['Date', 40], ['Amount', 110], ['Description', 165]]),
      row(120, [['11/14', 40], ['21.12', 120], ['ACME', 165], ['Store', 190]]),
    ]);
    expect(rows.map(t => [t.dateText, t.description, t.amount])).toEqual([['11/14', 'ACME Store', 21.12]]);
  });

  it('ends the table at a summary grid under its heading, and reads none of its figures', () => {
    const rows = readLayoutTransactions([
      row(100, [['DATE', 40], ['DESCRIPTION', 100], ['WITHDRAWALS', 330], ['DEPOSITS', 420], ['BALANCE', 500]]),
      row(115, [['JAN01', 40], ['TRANSFER', 100], ['600.00', 430], ['1,205.80', 495]]),
      row(130, [['JAN31', 40], ['NEW', 100], ['BALANCE', 120], ['1,205.80', 495]]),
      // The heading sits right over the grid's header, close enough to read as one.
      row(150, [['DEPOSITS,', 40], ['DIVIDENDS', 90], ['AND', 140], ['OTHER', 160], ['CREDITS', 190]]),
      row(156, [['DATE', 50], ['AMOUNT', 100], ['DATE', 200], ['AMOUNT', 250], ['DATE', 350], ['AMOUNT', 400]]),
      row(172, [['JAN01', 50], ['600.00', 105], ['JAN05', 200], ['230.00', 255], ['JAN31', 350], ['350.00', 405]]),
    ]);
    expect(rows.map(t => [t.dateText, t.description, t.credit])).toEqual([['JAN01', 'TRANSFER', 600]]);
  });
});
