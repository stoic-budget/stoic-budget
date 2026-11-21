import { BankName, FileType } from '@/entities/statement.entity';
import type { ParsedTransaction } from '@/modules/parsing/interfaces/parsed-statement.interface';
import { SofiParser, isSofiStatement, sofiEntry } from '@/modules/parsing/parsers/sofi.parser';

const STATEMENT = ['Transaction Details', 'Website www.sofi.com', 'Mailing Address SoFi Bank, N.A.'].join('\n');

const row = (paymentPurpose: string, amount: { debit?: number; credit?: number }): ParsedTransaction => ({
  transactionDate: new Date(2024, 7, 23),
  paymentPurpose,
  counterpartyName: paymentPurpose,
  currency: 'USD',
  ...amount,
});

describe('SofiParser', () => {
  it('knows its statement by its name and web address', () => {
    expect(isSofiStatement(STATEMENT)).toBe(true);
    expect(isSofiStatement('Transfer to www.sofi.com')).toBe(false);
  });

  it('parses its files under its own bank or OTHER, and PDFs only', async () => {
    const parser = new SofiParser();
    const claims = (bank: BankName, type = FileType.PDF) =>
      parser.canParse(bank, type, 'x.pdf', STATEMENT);
    await expect(claims(BankName.SOFI)).resolves.toBe(true);
    await expect(claims(BankName.OTHER)).resolves.toBe(true);
    await expect(claims(BankName.MARCUS)).resolves.toBe(false);
    await expect(claims(BankName.SOFI, FileType.CSV)).resolves.toBe(false);
  });

  it.each([
    ['Pay a Friend Member One Sender: Member Two Transaction ID: 33-1', { debit: 50 }, 'Member One', 'bank_transfer_out'],
    ['Debit Card ACME*STORE Transaction ID: 5-1', { debit: 34.39 }, 'ACME*STORE', 'card'],
    ['Interest Earned Interest earned Transaction ID: 47-1', { credit: 0.01 }, 'Interest earned', 'interest'],
  ])('reads %s', (purpose, amount, payee, paymentType) => {
    expect(sofiEntry(row(purpose, amount))).toMatchObject({ counterpartyName: payee, paymentType });
  });
});
