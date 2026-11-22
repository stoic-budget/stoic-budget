import { BankName, FileType } from '@/entities/statement.entity';
import type { ParsedTransaction } from '@/modules/parsing/interfaces/parsed-statement.interface';
import { EqBankParser, eqBankEntry, isEqBankStatement } from '@/modules/parsing/parsers/eq-bank.parser';

const STATEMENT = [
  'September 2024 Statement',
  'EQ Bank Cash Card - Ending in 1000 September 01, 2024 to September 30, 2024',
  'Equitable Bank Tower. 30 Sample Avenue West Page 1 of 7',
].join('\n');

const row = (paymentPurpose: string, amount: { debit?: number; credit?: number }): ParsedTransaction => ({
  transactionDate: new Date(2024, 8, 24),
  paymentPurpose,
  counterpartyName: paymentPurpose,
  currency: 'CAD',
  ...amount,
});

describe('EqBankParser', () => {
  it('knows its statement by the card and the bank', () => {
    expect(isEqBankStatement(STATEMENT)).toBe(true);
    expect(isEqBankStatement('Transfer to EQ Bank')).toBe(false);
  });

  it('parses its files under its own bank or OTHER, and PDFs only', async () => {
    const parser = new EqBankParser();
    const claims = (bank: BankName, type = FileType.PDF) =>
      parser.canParse(bank, type, 'x.pdf', STATEMENT);
    await expect(claims(BankName.EQ_BANK)).resolves.toBe(true);
    await expect(claims(BankName.OTHER)).resolves.toBe(true);
    await expect(claims(BankName.CIBC)).resolves.toBe(false);
    await expect(claims(BankName.EQ_BANK, FileType.CSV)).resolves.toBe(false);
  });

  it.each([
    ['Transfer from Linked account *', { credit: 10 }, 'bank_transfer_in'],
    ['Domestic ATM Fee Rebate', { credit: 1.85 }, 'fee'],
    ['ACME STORE, SAMPLETOWN, ON', { debit: 3.83 }, 'card'],
  ])('types %s', (purpose, amount, paymentType) => {
    expect(eqBankEntry(row(purpose, amount)).paymentType).toBe(paymentType);
  });
});
