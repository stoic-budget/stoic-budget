import { BankName, FileType } from '@/entities/statement.entity';
import type { ParsedTransaction } from '@/modules/parsing/interfaces/parsed-statement.interface';
import { UsaaParser, isUsaaStatement, usaaEntry } from '@/modules/parsing/parsers/usaa.parser';

const STATEMENT = ['USAA Federal Savings Bank', '10750 McDermott Freeway', 'USAA CLASSIC CHECKING'].join('\n');

const row = (paymentPurpose: string, amount: { debit?: number; credit?: number }): ParsedTransaction => ({
  transactionDate: new Date(2023, 2, 3),
  paymentPurpose,
  counterpartyName: paymentPurpose,
  currency: 'USD',
  ...amount,
});

describe('UsaaParser', () => {
  it('knows its statement by its name and address', () => {
    expect(isUsaaStatement(STATEMENT)).toBe(true);
    expect(isUsaaStatement('USAA CREDIT CARD PAYMENT')).toBe(false);
  });

  it('parses its files under its own bank or OTHER, and PDFs only', async () => {
    const parser = new UsaaParser();
    const claims = (bank: BankName, type = FileType.PDF) =>
      parser.canParse(bank, type, 'x.pdf', STATEMENT);
    await expect(claims(BankName.USAA)).resolves.toBe(true);
    await expect(claims(BankName.OTHER)).resolves.toBe(true);
    await expect(claims(BankName.NAVY_FEDERAL)).resolves.toBe(false);
    await expect(claims(BankName.USAA, FileType.CSV)).resolves.toBe(false);
  });

  it('reads a Zelle payment\'s person', () => {
    expect(usaaEntry(row('USAA CREDIT Zelle: Member One 1000000001', { credit: 10 }))).toMatchObject({
      counterpartyName: 'Member One',
      paymentType: 'bank_transfer_in',
    });
  });
});
