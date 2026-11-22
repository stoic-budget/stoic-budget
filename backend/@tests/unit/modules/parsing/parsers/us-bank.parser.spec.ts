import { BankName, FileType } from '@/entities/statement.entity';
import type { ParsedTransaction } from '@/modules/parsing/interfaces/parsed-statement.interface';
import { UsBankParser, isUsBankStatement, usBankEntry } from '@/modules/parsing/parsers/us-bank.parser';

const STATEMENT = ['Uni-Statement', 'By Phone: 1-800-US BANKS', 'U.S. Bank National Association'].join('\n');

const row = (paymentPurpose: string, amount: { debit?: number; credit?: number }): ParsedTransaction => ({
  transactionDate: new Date(2017, 2, 23),
  paymentPurpose,
  counterpartyName: paymentPurpose,
  currency: 'USD',
  ...amount,
});

describe('UsBankParser', () => {
  it('knows its statement by its legal name and phone line', () => {
    expect(isUsBankStatement(STATEMENT)).toBe(true);
    expect(isUsBankStatement('U.S. Bank National Association')).toBe(false);
  });

  it('parses its files under its own bank or OTHER, and PDFs only', async () => {
    const parser = new UsBankParser();
    const claims = (bank: BankName, type = FileType.PDF) =>
      parser.canParse(bank, type, 'x.pdf', STATEMENT);
    await expect(claims(BankName.US_BANK)).resolves.toBe(true);
    await expect(claims(BankName.OTHER)).resolves.toBe(true);
    await expect(claims(BankName.USAA)).resolves.toBe(false);
    await expect(claims(BankName.US_BANK, FileType.CSV)).resolves.toBe(false);
  });

  it('reads an electronic deposit\'s payer', () => {
    expect(usBankEntry(row('Electronic Deposit From ACME REF=100000000000000N00', { credit: 142.8 }))).toMatchObject({
      counterpartyName: 'ACME',
      paymentType: 'bank_transfer_in',
    });
  });
});
