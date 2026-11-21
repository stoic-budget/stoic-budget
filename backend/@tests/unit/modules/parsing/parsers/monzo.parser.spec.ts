import { BankName, FileType } from '@/entities/statement.entity';
import type { ParsedTransaction } from '@/modules/parsing/interfaces/parsed-statement.interface';
import { MonzoParser, isMonzoStatement, monzoEntry } from '@/modules/parsing/parsers/monzo.parser';

const STATEMENT = ['BIC: MONZGB2L', 'Monzo Bank Limited (https://monzo.com) is a company registered in England'].join(
  '\n',
);

const row = (paymentPurpose: string, amount: { debit?: number; credit?: number }): ParsedTransaction => ({
  transactionDate: new Date(2024, 2, 14),
  paymentPurpose,
  counterpartyName: paymentPurpose,
  currency: 'GBP',
  ...amount,
});

describe('MonzoParser', () => {
  it('knows its statement by the bank and its BIC', () => {
    expect(isMonzoStatement(STATEMENT)).toBe(true);
    expect(isMonzoStatement('Transfer to Monzo Bank Limited')).toBe(false);
  });

  it('parses its files under its own bank or OTHER, and PDFs only', async () => {
    const parser = new MonzoParser();
    const claims = (bank: BankName, type = FileType.PDF) =>
      parser.canParse(bank, type, 'x.pdf', STATEMENT);
    await expect(claims(BankName.MONZO)).resolves.toBe(true);
    await expect(claims(BankName.OTHER)).resolves.toBe(true);
    await expect(claims(BankName.KROO)).resolves.toBe(false);
    await expect(claims(BankName.MONZO, FileType.CSV)).resolves.toBe(false);
  });

  it.each([
    ['Member One (Faster Payments) Reference: rent', { credit: 225 }, 'Member One', 'bank_transfer_in'],
    ['Cashwithdraw CD1000000001', { debit: 200 }, 'Cash withdrawal', 'cash'],
    ['ACME STORE SAMPLETOWN GBR', { debit: 15.08 }, 'ACME STORE SAMPLETOWN GBR', 'card'],
  ])('reads %s', (purpose, amount, payee, paymentType) => {
    expect(monzoEntry(row(purpose, amount))).toMatchObject({ counterpartyName: payee, paymentType });
  });
});
