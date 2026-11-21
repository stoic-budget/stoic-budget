import { BankName, FileType } from '@/entities/statement.entity';
import type { ParsedTransaction } from '@/modules/parsing/interfaces/parsed-statement.interface';
import { TruistParser, isTruistStatement, truistEntry } from '@/modules/parsing/parsers/truist.parser';

const STATEMENT = ['TRUIST', 'BACK TO BASICS 1000000000001', 'please call us at 844-4TRUIST'].join('\n');

const row = (paymentPurpose: string, amount: { debit?: number; credit?: number }): ParsedTransaction => ({
  transactionDate: new Date(2022, 6, 7),
  paymentPurpose,
  counterpartyName: paymentPurpose,
  currency: 'USD',
  ...amount,
});

describe('TruistParser', () => {
  it('knows its statement by its name and phone line', () => {
    expect(isTruistStatement(STATEMENT)).toBe(true);
    expect(isTruistStatement('TRUIST')).toBe(false);
  });

  it('parses its files under its own bank or OTHER, and PDFs only', async () => {
    const parser = new TruistParser();
    const claims = (bank: BankName, type = FileType.PDF) =>
      parser.canParse(bank, type, 'x.pdf', STATEMENT);
    await expect(claims(BankName.TRUIST)).resolves.toBe(true);
    await expect(claims(BankName.OTHER)).resolves.toBe(true);
    await expect(claims(BankName.REGIONS)).resolves.toBe(false);
    await expect(claims(BankName.TRUIST, FileType.CSV)).resolves.toBe(false);
  });

  it.each([
    ['OVERDRAFT ITEM FEE ($36/ITEM)', { debit: 36 }, 'fee'],
    ['DEBIT CARD PURCHASE ACME STORE 07-25 SAMPLETOWN, CA', { debit: 17.05 }, 'card'],
    ['PAYROLL ACME LLC 1000 Member One', { credit: 781.02 }, 'bank_transfer_in'],
    ['ATM NETWORK CASH WITHDRAWAL 07-30-22 SAMPLETOWN, CA', { debit: 50 }, 'cash'],
  ])('types %s', (purpose, amount, paymentType) => {
    expect(truistEntry(row(purpose, amount)).paymentType).toBe(paymentType);
  });
});
