import { BankName, FileType } from '@/entities/statement.entity';
import type { ParsedTransaction } from '@/modules/parsing/interfaces/parsed-statement.interface';
import { RegionsParser, isRegionsStatement, regionsEntry } from '@/modules/parsing/parsers/regions.parser';

const STATEMENT = [
  'LIFEGREEN CHECKING',
  'For all your banking needs, please call 1-800-REGIONS (734-4667)',
  'or visit us on the Internet at www.regions.com.',
].join('\n');

const row = (paymentPurpose: string, amount: { debit?: number; credit?: number }): ParsedTransaction => ({
  transactionDate: new Date(2022, 9, 4),
  paymentPurpose,
  counterpartyName: paymentPurpose,
  currency: 'USD',
  ...amount,
});

describe('RegionsParser', () => {
  it('knows its statement by its phone line and web address', () => {
    expect(isRegionsStatement(STATEMENT)).toBe(true);
    expect(isRegionsStatement('Transfer to www.regions.com')).toBe(false);
  });

  it('parses its files under its own bank or OTHER, and PDFs only', async () => {
    const parser = new RegionsParser();
    const claims = (bank: BankName, type = FileType.PDF) =>
      parser.canParse(bank, type, 'x.pdf', STATEMENT);
    await expect(claims(BankName.REGIONS)).resolves.toBe(true);
    await expect(claims(BankName.OTHER)).resolves.toBe(true);
    await expect(claims(BankName.KEYBANK)).resolves.toBe(false);
    await expect(claims(BankName.REGIONS, FileType.CSV)).resolves.toBe(false);
  });

  it.each([
    ['Card Purchase ACME Store 206 5814 Sampletown NM 87000', { debit: 1.1 }, 'ACME Store 206', 'card'],
    ['ATM Imaged Deposit', { credit: 600 }, 'ATM Imaged Deposit', 'cash'],
    ['Deposit - Thank You', { credit: 445.88 }, 'Deposit - Thank You', 'bank_transfer_in'],
  ])('reads %s', (purpose, amount, payee, paymentType) => {
    expect(regionsEntry(row(purpose, amount))).toMatchObject({ counterpartyName: payee, paymentType });
  });
});
