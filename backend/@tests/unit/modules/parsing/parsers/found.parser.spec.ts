import { BankName, FileType } from '@/entities/statement.entity';
import type { ParsedTransaction } from '@/modules/parsing/interfaces/parsed-statement.interface';
import { FoundParser, foundEntry, isFoundStatement } from '@/modules/parsing/parsers/found.parser';

const STATEMENT = [
  'March 2025 Account Statement',
  'Statement period Routing number Account number',
  'March 1 to March 31, 2025 026 015 053 7000 1000 7274',
  'Found is a financial technology company, not a bank.',
].join('\n');

const row = (paymentPurpose: string, amount: { debit?: number; credit?: number }): ParsedTransaction => ({
  transactionDate: new Date(2025, 2, 1),
  paymentPurpose,
  counterpartyName: paymentPurpose,
  currency: 'USD',
  ...amount,
});

describe('FoundParser', () => {
  it('knows its statement by its footer', () => {
    expect(isFoundStatement(STATEMENT)).toBe(true);
    expect(isFoundStatement('Lost and found')).toBe(false);
  });

  it('parses its files under its own bank or OTHER, and PDFs only', async () => {
    const parser = new FoundParser();
    const claims = (bank: BankName, type = FileType.PDF) =>
      parser.canParse(bank, type, 'x.pdf', STATEMENT);
    await expect(claims(BankName.FOUND)).resolves.toBe(true);
    await expect(claims(BankName.OTHER)).resolves.toBe(true);
    await expect(claims(BankName.CHIME)).resolves.toBe(false);
    await expect(claims(BankName.FOUND, FileType.CSV)).resolves.toBe(false);
  });

  it.each([
    ['ACME Store (Sampletown, NC, USA) - TXN387777', { debit: 21.7 }, 'ACME Store', 'card'],
    ['Check Deposit from Member Two - Check #8386', { credit: 123.3 }, 'Member Two', 'bank_transfer_in'],
    ['Payroll Deduction - Example Payroll - Member Three', { debit: 3500 }, 'Member Three', 'bank_transfer_out'],
  ])('reads %s', (purpose, amount, payee, paymentType) => {
    expect(foundEntry(row(purpose, amount))).toMatchObject({ counterpartyName: payee, paymentType });
  });
});
