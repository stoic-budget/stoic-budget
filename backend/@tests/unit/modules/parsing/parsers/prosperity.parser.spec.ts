import { BankName, FileType } from '@/entities/statement.entity';
import type { ParsedTransaction } from '@/modules/parsing/interfaces/parsed-statement.interface';
import { ProsperityParser, isProsperityStatement, prosperityEntry } from '@/modules/parsing/parsers/prosperity.parser';

const STATEMENT = ['STATEMENT SUMMARY', 'OTHER DEBITS', 'DAILY ENDING BALANCE', 'MEMBER FDIC NYSE Symbol "PB"'].join('\n');

const row = (paymentPurpose: string, amount: { debit?: number; credit?: number }): ParsedTransaction => ({
  transactionDate: new Date(2022, 7, 18),
  paymentPurpose,
  counterpartyName: paymentPurpose,
  currency: 'USD',
  ...amount,
});

describe('ProsperityParser', () => {
  it('knows its statement by its name or stock symbol and its summary', () => {
    expect(isProsperityStatement(STATEMENT)).toBe(true);
    expect(isProsperityStatement('NYSE Symbol "PB"')).toBe(false);
  });

  it('parses its files under its own bank or OTHER, and PDFs only', async () => {
    const parser = new ProsperityParser();
    const claims = (bank: BankName, type = FileType.PDF) =>
      parser.canParse(bank, type, 'x.pdf', STATEMENT);
    await expect(claims(BankName.PROSPERITY)).resolves.toBe(true);
    await expect(claims(BankName.OTHER)).resolves.toBe(true);
    await expect(claims(BankName.FROST)).resolves.toBe(false);
    await expect(claims(BankName.PROSPERITY, FileType.CSV)).resolves.toBe(false);
  });

  it.each([
    ['POS Purchase ACME STORE SAMPLETOWN TX #1000', { debit: 9.71 }, 'ACME STORE SAMPLETOWN TX', 'card'],
    ['Debit Card - Sig ACME-CAFE SAMPLETOWN TX #1000', { debit: 6.67 }, 'ACME-CAFE SAMPLETOWN TX', 'card'],
    ['Opening Deposit', { credit: 100 }, 'Opening Deposit', 'bank_transfer_in'],
  ])('reads %s', (purpose, amount, payee, paymentType) => {
    expect(prosperityEntry(row(purpose, amount))).toMatchObject({ counterpartyName: payee, paymentType });
  });
});
