import { BankName, FileType } from '@/entities/statement.entity';
import type { ParsedTransaction } from '@/modules/parsing/interfaces/parsed-statement.interface';
import { MetroBankParser, isMetroBankStatement, metroBankEntry } from '@/modules/parsing/parsers/metro-bank.parser';

const STATEMENT = ['BIC: MYMBGB2L', 'Your Transactions', 'Metro Bank PLC is registered in England and Wales'].join('\n');

const row = (paymentPurpose: string, amount: { debit?: number; credit?: number }): ParsedTransaction => ({
  transactionDate: new Date(2019, 5, 2),
  paymentPurpose,
  counterpartyName: paymentPurpose,
  currency: 'GBP',
  ...amount,
});

describe('MetroBankParser', () => {
  it('knows its statement by the bank and its BIC', () => {
    expect(isMetroBankStatement(STATEMENT)).toBe(true);
    expect(isMetroBankStatement('Outward Fast Payments Metro Bank PLC')).toBe(false);
  });

  it('parses its files under its own bank or OTHER, and PDFs only', async () => {
    const parser = new MetroBankParser();
    const claims = (bank: BankName, type = FileType.PDF) =>
      parser.canParse(bank, type, 'x.pdf', STATEMENT);
    await expect(claims(BankName.METRO_BANK)).resolves.toBe(true);
    await expect(claims(BankName.OTHER)).resolves.toBe(true);
    await expect(claims(BankName.HSBC)).resolves.toBe(false);
    await expect(claims(BankName.METRO_BANK, FileType.CSV)).resolves.toBe(false);
  });

  it.each([
    ['Card Purchase 02/06/19 09:15:48 ACME STORE', { debit: 312.48 }, 'ACME STORE', 'card'],
    ['Inward Payments Member One', { credit: 380.15 }, 'Member One', 'bank_transfer_in'],
    ['Outward Fast Payments ACME Furniture', { debit: 55.2 }, 'ACME Furniture', 'bank_transfer_out'],
  ])('reads %s', (purpose, amount, payee, paymentType) => {
    expect(metroBankEntry(row(purpose, amount))).toMatchObject({ counterpartyName: payee, paymentType });
  });
});
