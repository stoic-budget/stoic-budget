import type { PdfTextRow } from '@/common/utils/pdf-parser.util';
import { readLayoutTransactions } from '@/modules/parsing/helpers/pdf-layout-table.helper';
import { splitByAccount } from '@/modules/parsing/helpers/pdf-layout-transactions.helper';
import {
  accountStatements,
  accountTexts,
} from '@/modules/parsing/helpers/statement-accounts.helper';

/** A word is [text, x]; width is 5pt per character, height 8pt. */
type Word = [string, number];

const row = (y: number, words: Word[], page = 1): PdfTextRow => ({
  page,
  y,
  text: words.map(([text]) => text).join(' '),
  items: words.map(([text, x]) => ({ text, x, y, width: text.length * 5, height: 8, page })),
});

const header = row(100, [
  ['Date', 40],
  ['Description', 110],
  ['Amount', 400],
]);

const heading = (number: string, y: number, page: number) =>
  row(y, [['Account', 300], ['number:', 345], [number, 385]], page);

/** Two accounts with rows and, between them, one that moved no money. */
const rows = [
  heading('0001 0000 0001', 60, 1),
  row(70, [['Beginning', 40], ['balance', 90], ['on', 130], ['July', 145], ['1,', 170], ['2024', 185], ['$100.00', 300]], 1),
  row(80, [['Ending', 40], ['balance', 90], ['on', 130], ['July', 145], ['31,', 170], ['2024', 185], ['$90.00', 300]], 1),
  header,
  row(140, [['07/05/24', 40], ['ACME', 110], ['-10.00', 405]], 1),
  heading('0001 0000 0002', 60, 2),
  row(70, [['Beginning', 40], ['balance', 90], ['on', 130], ['July', 145], ['1,', 170], ['2024', 185], ['$50.00', 300]], 2),
  row(80, [['Ending', 40], ['balance', 90], ['on', 130], ['July', 145], ['31,', 170], ['2024', 185], ['$50.00', 300]], 2),
  heading('0001 0000 0003', 60, 3),
  row(70, [['Beginning', 40], ['balance', 90], ['on', 130], ['July', 145], ['1,', 170], ['2024', 185], ['$5.00', 300]], 3),
  row(80, [['Ending', 40], ['balance', 90], ['on', 130], ['July', 145], ['31,', 170], ['2024', 185], ['$7.00', 300]], 3),
  row(100, [['Date', 40], ['Description', 110], ['Amount', 400]], 3),
  row(140, [['07/31/24', 40], ['Interest', 110], ['2.00', 405]], 3),
];

describe('statement-accounts.helper', () => {
  it('collects the text printed under each account heading', () => {
    const texts = accountTexts(rows);
    expect([...texts.keys()]).toEqual(['0001 0000 0001', '0001 0000 0002', '0001 0000 0003']);
    expect(texts.get('0001 0000 0002')).toContain('$50.00');
    expect(texts.get('0001 0000 0002')).not.toContain('ACME');
  });

  it("gives each account the balances printed under its own heading, a quiet one included", () => {
    const groups = splitByAccount(readLayoutTransactions(rows));
    const accounts = accountStatements(groups, {
      text: rows.map(line => line.text).join('\n'),
      texts: accountTexts(rows),
      dateOrder: 'mdy',
      latestPrinted: new Date(2024, 6, 31),
      currency: 'USD',
      isCard: false,
    });
    expect(
      accounts.map(account => [
        account.metadata.accountNumber,
        account.metadata.balanceStart,
        account.metadata.balanceEnd,
        account.transactions.length,
      ]),
    ).toEqual([
      ['0001 0000 0001', 100, 90, 1],
      ['0001 0000 0002', 50, 50, 0],
      ['0001 0000 0003', 5, 7, 1],
    ]);
  });
});
