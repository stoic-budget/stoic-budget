import { BankName, FileType } from '@/entities/statement.entity';
import type { ParsedTransaction } from '@/modules/parsing/interfaces/parsed-statement.interface';
import { TdParser, isTdStatement, tdEntry } from '@/modules/parsing/parsers/td.parser';

const STATEMENT = ['Statement of Account', 'JUL 31/24 - AUG 30/24', 'ACCOUNT ISSUED BY: THE TORONTO-DOMINION BANK'].join('\n');

const row = (paymentPurpose: string, amount: { debit?: number; credit?: number }): ParsedTransaction => ({
  transactionDate: new Date(2024, 7, 6),
  paymentPurpose,
  counterpartyName: paymentPurpose,
  currency: 'CAD',
  ...amount,
});

describe('TdParser', () => {
  it('knows its statement by its legal name and title', () => {
    expect(isTdStatement(STATEMENT)).toBe(true);
    expect(isTdStatement('Statement of Account')).toBe(false);
  });

  it('parses its files under its own bank or OTHER, and PDFs only', async () => {
    const parser = new TdParser();
    const claims = (bank: BankName, type = FileType.PDF) =>
      parser.canParse(bank, type, 'x.pdf', STATEMENT);
    await expect(claims(BankName.TD)).resolves.toBe(true);
    await expect(claims(BankName.OTHER)).resolves.toBe(true);
    await expect(claims(BankName.RBC)).resolves.toBe(false);
    await expect(claims(BankName.TD, FileType.CSV)).resolves.toBe(false);
  });

  it.each([
    ['TD ATM DEP 001000', { credit: 815.69 }, 'cash'],
    ['MONTHLY ACCOUNT FEE', { debit: 16.95 }, 'fee'],
    ['PTS TO: 10000000001', { debit: 200 }, 'bank_transfer_out'],
  ])('types %s', (purpose, amount, paymentType) => {
    expect(tdEntry(row(purpose, amount)).paymentType).toBe(paymentType);
  });
});
