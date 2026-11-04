import { BankName, FileType } from '@/entities/statement.entity';
import type { ParsedTransaction } from '@/modules/parsing/interfaces/parsed-statement.interface';
import {
  CommercialBankParser,
  commercialEntry,
  isCommercialBankStatement,
} from '@/modules/parsing/parsers/commercial-bank.parser';

const STATEMENT = [
  'STATEMENT OF ACCOUNT IN ACCOUNT WITH',
  'COMMERCIAL BANK OF CEYLON',
  'DATE PARTICULARS PAYMENTS RECEIPTS BALANCE',
  'WHEN OVERDRAWN',
  'MARKED DR',
].join('\n');

const row = (paymentPurpose: string): ParsedTransaction => ({
  transactionDate: new Date(2023, 8, 12),
  paymentPurpose,
  counterpartyName: paymentPurpose,
  currency: 'LKR',
  debit: 1,
});

describe('CommercialBankParser', () => {
  it('knows its statement by the bank name and the note under the balance', () => {
    expect(isCommercialBankStatement(STATEMENT)).toBe(true);
    expect(isCommercialBankStatement(STATEMENT.replace('CEYLON', 'CYELON'))).toBe(true);
    expect(isCommercialBankStatement('COMMERCIAL BANK OF CEYLON')).toBe(false);
    expect(isCommercialBankStatement('ACME COMMERCIAL BANK\nWHEN OVERDRAWN')).toBe(false);
  });

  it('parses its files under its own bank or OTHER, and PDFs only', async () => {
    const parser = new CommercialBankParser();
    const claims = (bank: BankName, type = FileType.PDF) =>
      parser.canParse(bank, type, 'x.pdf', STATEMENT);
    await expect(claims(BankName.COMMERCIAL_BANK)).resolves.toBe(true);
    await expect(claims(BankName.OTHER)).resolves.toBe(true);
    await expect(claims(BankName.COMMERCE_BANK)).resolves.toBe(false);
    await expect(claims(BankName.COMMERCIAL_BANK, FileType.CSV)).resolves.toBe(false);
  });

  it.each([
    ['cash', 'cash'],
    ['WITHDRAWL ACME STORE', 'cash'],
    ['PURCHASE ACME STORE', 'card'],
    ['INTREST', 'interest'],
    ['INTEREST', 'interest'],
    ['TO 1000000001', 'bank_transfer_out'],
  ])('types %s', (purpose, paymentType) => {
    expect(commercialEntry(row(purpose)).paymentType).toBe(paymentType);
  });

  it('leaves an entry its words do not name untyped', () => {
    expect(commercialEntry(row('ACME PAYROLL')).paymentType).toBeUndefined();
  });
});
