import { BankName, FileType } from '@/entities/statement.entity';
import type { ParsedTransaction } from '@/modules/parsing/interfaces/parsed-statement.interface';
import { WestpacParser, isWestpacStatement, westpacEntry } from '@/modules/parsing/parsers/westpac.parser';

const STATEMENT = ['Electronic Statement', 'BSB Account Number', 'promptly inform Westpac of any possible error'].join('\n');

const row = (paymentPurpose: string, amount: { debit?: number; credit?: number }): ParsedTransaction => ({
  transactionDate: new Date(2025, 2, 26),
  paymentPurpose,
  counterpartyName: paymentPurpose,
  currency: 'AUD',
  ...amount,
});

describe('WestpacParser', () => {
  it('knows its statement by its name and BSB label', () => {
    expect(isWestpacStatement(STATEMENT)).toBe(true);
    expect(isWestpacStatement('Transfer to Westpac')).toBe(false);
  });

  it('parses its files under its own bank or OTHER, and PDFs only', async () => {
    const parser = new WestpacParser();
    const claims = (bank: BankName, type = FileType.PDF) =>
      parser.canParse(bank, type, 'x.pdf', STATEMENT);
    await expect(claims(BankName.WESTPAC)).resolves.toBe(true);
    await expect(claims(BankName.OTHER)).resolves.toBe(true);
    await expect(claims(BankName.NAB)).resolves.toBe(false);
    await expect(claims(BankName.WESTPAC, FileType.CSV)).resolves.toBe(false);
  });

  it.each([
    ['Debit Card Purchase ACME Store Sampletown Aus', { debit: 20 }, 'ACME Store Sampletown', 'card'],
    ['Deposit-Osko Payment 1000001 Member One Deposit-Salary', { credit: 200 }, 'Member One', 'bank_transfer_in'],
  ])('reads %s', (purpose, amount, payee, paymentType) => {
    expect(westpacEntry(row(purpose, amount))).toMatchObject({ counterpartyName: payee, paymentType });
  });
});
