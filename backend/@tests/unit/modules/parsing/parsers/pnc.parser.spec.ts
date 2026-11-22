import type { PdfTextRow } from '@/common/utils/pdf-parser.util';
import { BankName, FileType } from '@/entities/statement.entity';
import type { ParsedTransaction } from '@/modules/parsing/interfaces/parsed-statement.interface';
import {
  PncParser,
  isPncStatement,
  pncBalances,
  pncEntry,
  withoutMarginNotes,
} from '@/modules/parsing/parsers/pnc.parser';

const STATEMENT = ['Virtual Wallet Spend Statement', 'For customer service call 1-888-PNC-BANK', 'Visit us at pnc.com'].join('\n');

const line = (y: number, words: [string, number][]): PdfTextRow => ({
  page: 3,
  y,
  text: words.map(([text]) => text).join(' '),
  items: words.map(([text, x]) => ({ text, x, y, width: text.length * 5, height: 8, page: 3 })),
});

const row = (paymentPurpose: string, amount: { debit?: number; credit?: number }): ParsedTransaction => ({
  transactionDate: new Date(2024, 2, 4),
  paymentPurpose,
  counterpartyName: paymentPurpose,
  currency: 'USD',
  ...amount,
});

describe('PncParser', () => {
  it('knows its statement by its phone line and web address', () => {
    expect(isPncStatement(STATEMENT)).toBe(true);
    expect(isPncStatement('Payment to pnc.com')).toBe(false);
  });

  it('parses its files under its own bank or OTHER, and PDFs only', async () => {
    const parser = new PncParser();
    const claims = (bank: BankName, type = FileType.PDF) =>
      parser.canParse(bank, type, 'x.pdf', STATEMENT);
    await expect(claims(BankName.PNC)).resolves.toBe(true);
    await expect(claims(BankName.OTHER)).resolves.toBe(true);
    await expect(claims(BankName.KEYBANK)).resolves.toBe(false);
    await expect(claims(BankName.PNC, FileType.CSV)).resolves.toBe(false);
  });

  it('leaves the margin notes out, on the heading and the rows alike', () => {
    const rows = withoutMarginNotes([
      line(588, [['Banking/Debit', 32], ['Card', 97], ['Withdrawals', 121], ['There', 380], ['were', 406], ['8', 428]]),
      line(628, [['03/01', 32], ['69.34', 129], ['POS', 171], ['Purchase', 195], ['Machine/Debit', 380]]),
    ]);
    expect(rows.map(kept => kept.text)).toEqual(['Banking/Debit Card Withdrawals', '03/01 69.34 POS Purchase']);
  });

  it('takes the balances from the summary grid', () => {
    const text = 'Beginning Deposits and Checks and other Ending\nbalance other additions deductions balance\n770.78 .00 777.78 7.00-';
    expect(pncBalances(text)).toEqual({ start: 770.78, end: -7 });
  });

  it('reads a card purchase\'s shop', () => {
    expect(pncEntry(row('1000 Debit Card Purchase ACME Store', { debit: 19.89 }))).toMatchObject({
      counterpartyName: 'ACME Store',
      paymentType: 'card',
    });
  });
});
