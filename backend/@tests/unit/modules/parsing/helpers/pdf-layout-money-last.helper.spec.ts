import type { PdfTextRow } from '@/common/utils/pdf-parser.util';
import {
  hasMoney,
  joinMoneyLastEntries,
  joinMoneyLastTable,
} from '@/modules/parsing/helpers/pdf-layout-money-last.helper';

const row = (y: number, words: [string, number][]): PdfTextRow => ({
  page: 1,
  y,
  text: words.map(([text]) => text).join(' '),
  items: words.map(([text, x]) => ({ text, x, y, width: text.length * 5, height: 8, page: 1 })),
});

describe('joinMoneyLastEntries', () => {
  it('lays an entry with its money on the last line out as one row, the day carried', () => {
    const header = row(90, [['Date', 60], ['Description', 111], ['Balance', 478]]);
    const rows = joinMoneyLastEntries(
      [
        header,
        row(100, [['14', 60], ['DEC', 72], ['Card', 111], ['ACME', 140]]),
        row(110, [['SAMPLETOWN', 111], ['27.62', 431], ['10,059.49', 485]]),
        row(120, [['Card', 111], ['ACME', 140], ['CAFE', 170]]),
        row(130, [['SAMPLETOWN', 111], ['35.40', 431], ['10,024.09', 485]]),
      ],
      (line, before) => before !== null && (before === header || hasMoney(before)),
    );
    expect(rows.map(line => line.text)).toEqual([
      'Date Description Balance',
      '14 DEC Card ACME 27.62 10,059.49',
      'SAMPLETOWN',
      '14 DEC Card ACME CAFE 35.40 10,024.09',
      'SAMPLETOWN',
    ]);
  });
});

describe('joinMoneyLastTable', () => {
  it('opens an entry after the header or the last money, and leaves lines above the header alone', () => {
    const rows = joinMoneyLastTable(
      [
        row(80, [['Summary', 60], ['1,000.00', 431]]),
        row(90, [['Date', 60], ['Description', 111], ['Withdrawals', 300], ['Deposits', 380]]),
        row(100, [['24', 60], ['Dec', 72], ['Interac', 111], ['purchase', 150]]),
        row(110, [['ACME', 115], ['STORE', 145], ['12.34', 431]]),
        row(120, [['e-Transfer', 111], ['sent', 160], ['40.00', 431]]),
      ],
      line => line.text.startsWith('Date Description'),
    );
    expect(rows.map(line => line.text)).toEqual([
      'Summary 1,000.00',
      'Date Description Withdrawals Deposits',
      '24 Dec Interac purchase 12.34',
      'ACME STORE',
      '24 Dec e-Transfer sent 40.00',
    ]);
  });
});

describe('figures in an entry\'s text', () => {
  it('are no money of the entry: only those under the money headings close it', () => {
    const rows = joinMoneyLastTable(
      [
        row(90, [['DATE', 40], ['TRANSACTION', 100], ['DESCRIPTION', 160], ['DEBIT', 430], ['CREDIT', 490], ['BALANCE', 550]]),
        row(100, [['26/03/25', 40], ['Debit', 100], ['Card', 130], ['Purchase', 160]]),
        row(110, [['Usa', 100], ['Usd', 120], ['9.99', 140], ['incl.', 165]]),
        row(120, [['Fee', 100], ['Aud', 120], ['$0.39', 140], ['13.60', 430], ['317.18', 550]]),
      ],
      line => line.text.startsWith('DATE'),
    );
    expect(rows.map(line => line.text)).toEqual([
      'DATE TRANSACTION DESCRIPTION DEBIT CREDIT BALANCE',
      '26/03/25 Debit Card Purchase 13.60 317.18',
      'Usa Usd 9.99 incl.',
      'Fee Aud $0.39',
    ]);
  });
});
