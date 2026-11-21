import { BankName, FileType } from '@/entities/statement.entity';
import type { ParsedTransaction } from '@/modules/parsing/interfaces/parsed-statement.interface';
import { NationwideParser, isNationwideStatement, nationwideEntry } from '@/modules/parsing/parsers/nationwide.parser';

const STATEMENT = ['YourFlexAccount transactions', 'Online nationwide.co.uk', 'Phone 0800 30 20 11'].join('\n');

const row = (paymentPurpose: string, amount: { debit?: number; credit?: number }): ParsedTransaction => ({
  transactionDate: new Date(2020, 3, 6),
  paymentPurpose,
  counterpartyName: paymentPurpose,
  currency: 'GBP',
  ...amount,
});

describe('NationwideParser', () => {
  it('knows its statement by its web address and account name', () => {
    expect(isNationwideStatement(STATEMENT)).toBe(true);
    expect(isNationwideStatement('Cash Machine wdl Nationwide')).toBe(false);
  });

  it('parses its files under its own bank or OTHER, and PDFs only', async () => {
    const parser = new NationwideParser();
    const claims = (bank: BankName, type = FileType.PDF) =>
      parser.canParse(bank, type, 'x.pdf', STATEMENT);
    await expect(claims(BankName.NATIONWIDE)).resolves.toBe(true);
    await expect(claims(BankName.OTHER)).resolves.toBe(true);
    await expect(claims(BankName.HALIFAX)).resolves.toBe(false);
    await expect(claims(BankName.NATIONWIDE, FileType.CSV)).resolves.toBe(false);
  });

  it.each([
    ['Visa ACME Store Sampletown', { debit: 12 }, 'card'],
    ['Cash Machine wdl Nationwide', { debit: 20 }, 'cash'],
    ['Transfer to 10000001', { debit: 100 }, 'bank_transfer_out'],
    ['Bank Credit 1000001', { credit: 50 }, 'bank_transfer_in'],
  ])('types %s', (purpose, amount, paymentType) => {
    expect(nationwideEntry(row(purpose, amount)).paymentType).toBe(paymentType);
  });
});
