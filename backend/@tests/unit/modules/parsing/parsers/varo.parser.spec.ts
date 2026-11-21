import { BankName, FileType } from '@/entities/statement.entity';
import type { ParsedTransaction } from '@/modules/parsing/interfaces/parsed-statement.interface';
import { VaroParser, isVaroStatement, varoEntry } from '@/modules/parsing/parsers/varo.parser';

const STATEMENT = ['Varo Bank Account Statement', 'support@varomoney.com', 'Summary for Bank Account 100000001'].join('\n');

const row = (paymentPurpose: string, amount: { debit?: number; credit?: number }): ParsedTransaction => ({
  transactionDate: new Date(2023, 5, 5),
  paymentPurpose,
  counterpartyName: paymentPurpose,
  currency: 'USD',
  ...amount,
});

describe('VaroParser', () => {
  it('knows its statement by its name and support address', () => {
    expect(isVaroStatement(STATEMENT)).toBe(true);
    expect(isVaroStatement('Varo Bank Account Statement')).toBe(false);
  });

  it('parses its files under its own bank or OTHER, and PDFs only', async () => {
    const parser = new VaroParser();
    const claims = (bank: BankName, type = FileType.PDF) =>
      parser.canParse(bank, type, 'x.pdf', STATEMENT);
    await expect(claims(BankName.VARO)).resolves.toBe(true);
    await expect(claims(BankName.OTHER)).resolves.toBe(true);
    await expect(claims(BankName.CHIME)).resolves.toBe(false);
    await expect(claims(BankName.VARO, FileType.CSV)).resolves.toBe(false);
  });

  it.each([
    ['Debit Card (Purchase) ACME Store Sampletown', { debit: 1500 }, 'ACME Store Sampletown', 'card'],
    ['Payment Member One', { credit: 2000 }, 'Member One', 'bank_transfer_in'],
  ])('reads %s', (purpose, amount, payee, paymentType) => {
    expect(varoEntry(row(purpose, amount))).toMatchObject({ counterpartyName: payee, paymentType });
  });
});
