import { BankName, FileType } from '@/entities/statement.entity';
import type { ParsedTransaction } from '@/modules/parsing/interfaces/parsed-statement.interface';
import { SynovusParser, isSynovusStatement, synovusEntry } from '@/modules/parsing/parsers/synovus.parser';

const STATEMENT = ['P.O. Box 2646-R, Columbus, GA 31902', 'Statement of Account'].join('\n');

const row = (paymentPurpose: string, amount: { debit?: number; credit?: number }): ParsedTransaction => ({
  transactionDate: new Date(2021, 11, 6),
  paymentPurpose,
  counterpartyName: paymentPurpose,
  currency: 'USD',
  ...amount,
});

describe('SynovusParser', () => {
  it('knows its statement by its mailing address', () => {
    expect(isSynovusStatement(STATEMENT)).toBe(true);
    expect(isSynovusStatement('Statement of Account')).toBe(false);
  });

  it('parses its files under its own bank or OTHER, and PDFs only', async () => {
    const parser = new SynovusParser();
    const claims = (bank: BankName, type = FileType.PDF) =>
      parser.canParse(bank, type, 'x.pdf', STATEMENT);
    await expect(claims(BankName.SYNOVUS)).resolves.toBe(true);
    await expect(claims(BankName.OTHER)).resolves.toBe(true);
    await expect(claims(BankName.REGIONS)).resolves.toBe(false);
    await expect(claims(BankName.SYNOVUS, FileType.CSV)).resolves.toBe(false);
  });

  it.each([
    ['Check Card Purchase MERCHANT PURCHASE TERMINAL 100000 ACME STORE SAMPLETOWN CA TRAN DATE 12-03-21', { debit: 70 }, 'ACME STORE SAMPLETOWN CA', 'card'],
    ['Preauthorized Wd ACME FINANCE BILLING 211203', { debit: 31.01 }, 'ACME FINANCE BILLING 211203', 'direct_debit'],
    ['Preauthorized Credit ACME PAYROLL 1000', { credit: 100 }, 'ACME PAYROLL 1000', 'bank_transfer_in'],
  ])('reads %s', (purpose, amount, payee, paymentType) => {
    expect(synovusEntry(row(purpose, amount))).toMatchObject({ counterpartyName: payee, paymentType });
  });
});
