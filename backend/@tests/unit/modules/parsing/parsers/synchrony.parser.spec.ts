import { BankName, FileType } from '@/entities/statement.entity';
import type { ParsedTransaction } from '@/modules/parsing/interfaces/parsed-statement.interface';
import { SynchronyParser, isSynchronyStatement, synchronyEntry } from '@/modules/parsing/parsers/synchrony.parser';

const STATEMENT = ['Managing Your Accounts', 'Online synchronybank.com', 'Synchrony Bank'].join('\n');

const row = (paymentPurpose: string, amount: { debit?: number; credit?: number }): ParsedTransaction => ({
  transactionDate: new Date(2023, 4, 23),
  paymentPurpose,
  counterpartyName: paymentPurpose,
  currency: 'USD',
  ...amount,
});

describe('SynchronyParser', () => {
  it('knows its statement by its name and web address', () => {
    expect(isSynchronyStatement(STATEMENT)).toBe(true);
    expect(isSynchronyStatement('Banking services provided by Synchrony Bank')).toBe(false);
  });

  it('parses its files under its own bank or OTHER, and PDFs only', async () => {
    const parser = new SynchronyParser();
    const claims = (bank: BankName, type = FileType.PDF) =>
      parser.canParse(bank, type, 'x.pdf', STATEMENT);
    await expect(claims(BankName.SYNCHRONY)).resolves.toBe(true);
    await expect(claims(BankName.OTHER)).resolves.toBe(true);
    await expect(claims(BankName.PAYPAL)).resolves.toBe(false);
    await expect(claims(BankName.SYNCHRONY, FileType.CSV)).resolves.toBe(false);
  });

  it.each([
    ['ATM W/D 100000000001 1000 1000 Sample Rd', { debit: 10 }, 'cash'],
    ['Surcharge', { debit: 2 }, 'fee'],
    ['INT PMT', { credit: 0.03 }, 'interest'],
  ])('types %s', (purpose, amount, paymentType) => {
    expect(synchronyEntry(row(purpose, amount)).paymentType).toBe(paymentType);
  });
});
