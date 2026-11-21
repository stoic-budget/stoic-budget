import { BankName, FileType } from '@/entities/statement.entity';
import type { ParsedTransaction } from '@/modules/parsing/interfaces/parsed-statement.interface';
import { WebsterParser, isWebsterStatement, websterEntry } from '@/modules/parsing/parsers/webster.parser';

const STATEMENT = ['P.O. Box 191', 'Waterbury, CT 06720-0191', 'Online Access websterbank.com'].join('\n');

const row = (paymentPurpose: string, amount: { debit?: number; credit?: number }): ParsedTransaction => ({
  transactionDate: new Date(2025, 4, 23),
  paymentPurpose,
  counterpartyName: paymentPurpose,
  currency: 'USD',
  ...amount,
});

describe('WebsterParser', () => {
  it('knows its statement by its web address and mailing address', () => {
    expect(isWebsterStatement(STATEMENT)).toBe(true);
    expect(isWebsterStatement('Payment to websterbank.com')).toBe(false);
  });

  it('parses its files under its own bank or OTHER, and PDFs only', async () => {
    const parser = new WebsterParser();
    const claims = (bank: BankName, type = FileType.PDF) =>
      parser.canParse(bank, type, 'x.pdf', STATEMENT);
    await expect(claims(BankName.WEBSTER)).resolves.toBe(true);
    await expect(claims(BankName.OTHER)).resolves.toBe(true);
    await expect(claims(BankName.SYNCHRONY)).resolves.toBe(false);
    await expect(claims(BankName.WEBSTER, FileType.CSV)).resolves.toBe(false);
  });

  it.each([
    ['ACME AUTO PYMT MEMBER ONE XXXXXXXXXXX1000', { debit: 100 }, 'direct_debit'],
    ['SAMPLE,MEMBER TRANSFER MEMBER ONE', { credit: 3000 }, 'bank_transfer_in'],
  ])('types %s', (purpose, amount, paymentType) => {
    expect(websterEntry(row(purpose, amount)).paymentType).toBe(paymentType);
  });
});
