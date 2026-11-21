import type { PdfTextRow } from '@/common/utils/pdf-parser.util';
import { BankName, FileType } from '@/entities/statement.entity';
import type { ParsedTransaction } from '@/modules/parsing/interfaces/parsed-statement.interface';
import { WiseParser, isWiseStatement, readWiseRows, wiseEntry } from '@/modules/parsing/parsers/wise.parser';

const STATEMENT = ['Wise Payments Ltd.', 'USD statement', 'Need help? Visit wise.com/help'].join('\n');

const line = (y: number, words: [string, number][]): PdfTextRow => ({
  page: 1,
  y,
  text: words.map(([text]) => text).join(' '),
  items: words.map(([text, x]) => ({ text, x, y, width: text.length * 5, height: 8 })),
});

const row = (paymentPurpose: string): ParsedTransaction => ({
  transactionDate: new Date(2023, 3, 26),
  paymentPurpose,
  counterpartyName: paymentPurpose,
  currency: 'USD',
  debit: 30,
});

describe('WiseParser', () => {
  it('knows its statement by the company and its address', () => {
    expect(isWiseStatement(STATEMENT)).toBe(true);
    expect(isWiseStatement('Card payment to wise.com')).toBe(false);
  });

  it('parses its files under its own bank or OTHER, and PDFs only', async () => {
    const parser = new WiseParser();
    const claims = (bank: BankName, type = FileType.PDF) =>
      parser.canParse(bank, type, 'x.pdf', STATEMENT);
    await expect(claims(BankName.WISE)).resolves.toBe(true);
    await expect(claims(BankName.OTHER)).resolves.toBe(true);
    await expect(claims(BankName.REVOLUT)).resolves.toBe(false);
    await expect(claims(BankName.WISE, FileType.CSV)).resolves.toBe(false);
  });

  it('reads a movement over its date and reference', () => {
    const [read] = readWiseRows([
      line(431, [['Sent', 29], ['money', 48], ['to', 75], ['MEMBER', 85], ['ONE', 125]]),
      line(434, [['-30.00', 455], ['0.00', 549]]),
      line(444, [['26', 29], ['April', 39], ['2023', 57], ['|', 76], ['Transaction:', 81], ['TRANSFER-1000001', 126]]),
    ]);
    expect(read).toMatchObject({
      date: { day: 26, month: 4, year: 2023 },
      description: 'Sent money to MEMBER ONE TRANSFER-1000001',
      debit: 30,
      balance: 0,
    });
  });

  it('reads the party of a transfer', () => {
    expect(wiseEntry(row('Sent money to MEMBER ONE TRANSFER-1000001'))).toMatchObject({
      counterpartyName: 'MEMBER ONE',
      paymentType: 'bank_transfer_out',
    });
  });
});
