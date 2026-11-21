import { BankName, FileType } from '@/entities/statement.entity';
import type { ParsedTransaction } from '@/modules/parsing/interfaces/parsed-statement.interface';
import { NatwestParser, isNatwestStatement, natwestEntry } from '@/modules/parsing/parsers/natwest.parser';

const STATEMENT = ['Welcome to your NatWest Statement', 'BIC NWBKGB2L', 'IBAN GB00NWBK60000010000004'].join('\n');

const row = (paymentPurpose: string, amount: { debit?: number; credit?: number }): ParsedTransaction => ({
  transactionDate: new Date(2023, 11, 14),
  paymentPurpose,
  counterpartyName: paymentPurpose,
  currency: 'GBP',
  ...amount,
});

describe('NatwestParser', () => {
  it('knows its statement by its name and BIC', () => {
    expect(isNatwestStatement(STATEMENT)).toBe(true);
    expect(isNatwestStatement('Direct Debit NATWEST BNPL')).toBe(false);
  });

  it('parses its files under its own bank or OTHER, and PDFs only', async () => {
    const parser = new NatwestParser();
    const claims = (bank: BankName, type = FileType.PDF) =>
      parser.canParse(bank, type, 'x.pdf', STATEMENT);
    await expect(claims(BankName.NATWEST)).resolves.toBe(true);
    await expect(claims(BankName.OTHER)).resolves.toBe(true);
    await expect(claims(BankName.HSBC)).resolves.toBe(false);
    await expect(claims(BankName.NATWEST, FileType.CSV)).resolves.toBe(false);
  });

  it.each([
    ['Card Transaction 1000 13DEC23 C ACME STORES 4357 SAMPLETOWN GB', { debit: 27.62 }, 'ACME STORES 4357 SAMPLETOWN GB', 'card'],
    ['Automated Credit F SAMPLE FP 15/12/23 1709', { credit: 4.49 }, 'Automated Credit F SAMPLE FP 15/12/23 1709', 'bank_transfer_in'],
    ['Standing Order MEMBER ONE', { debit: 100 }, 'Standing Order MEMBER ONE', 'standing_order'],
  ])('reads %s', (purpose, amount, payee, paymentType) => {
    expect(natwestEntry(row(purpose, amount))).toMatchObject({ counterpartyName: payee, paymentType });
  });
});
