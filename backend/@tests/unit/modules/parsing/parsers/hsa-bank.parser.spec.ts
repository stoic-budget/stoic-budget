import { BankName, FileType } from '@/entities/statement.entity';
import type { ParsedTransaction } from '@/modules/parsing/interfaces/parsed-statement.interface';
import { HsaBankParser, hsaBankEntry, isHsaBankStatement } from '@/modules/parsing/parsers/hsa-bank.parser';

const STATEMENT = [
  'Participant Account ID: xxxxxx1000',
  'HSA Bank Client Assistance Center: (800) 357-6246',
  'HSA Bank® is a division of Webster Bank, N.A., Member FDIC',
].join('\n');

const row = (paymentPurpose: string, amount: { debit?: number; credit?: number }): ParsedTransaction => ({
  transactionDate: new Date(2023, 5, 1),
  paymentPurpose,
  counterpartyName: paymentPurpose,
  currency: 'USD',
  ...amount,
});

describe('HsaBankParser', () => {
  it('knows its statement by its division line and assistance center', () => {
    expect(isHsaBankStatement(STATEMENT)).toBe(true);
    expect(isHsaBankStatement('Webster Bank statement')).toBe(false);
  });

  it('parses its files under its own bank or OTHER, and PDFs only', async () => {
    const parser = new HsaBankParser();
    const claims = (bank: BankName, type = FileType.PDF) =>
      parser.canParse(bank, type, 'x.pdf', STATEMENT);
    await expect(claims(BankName.HSA_BANK)).resolves.toBe(true);
    await expect(claims(BankName.OTHER)).resolves.toBe(true);
    await expect(claims(BankName.CHASE)).resolves.toBe(false);
    await expect(claims(BankName.HSA_BANK, FileType.CSV)).resolves.toBe(false);
  });

  it.each([
    ['EFT Participant Contribution', { credit: 34 }, 'bank_transfer_in'],
    ['EFT Adjustment Distribution', { debit: 34 }, 'bank_transfer_out'],
  ])('types %s', (purpose, amount, paymentType) => {
    expect(hsaBankEntry(row(purpose, amount)).paymentType).toBe(paymentType);
  });
});
