import { BankName, FileType } from '@/entities/statement.entity';
import type { ParsedTransaction } from '@/modules/parsing/interfaces/parsed-statement.interface';
import { HeritageParser, heritageEntry, isHeritageStatement } from '@/modules/parsing/parsers/heritage.parser';

const STATEMENT = ['VISA GOLD LOW RATES STATEMENT', 'Heritage Bank Limited', 'ABN 32 087 652 024 AFSL 240984'].join('\n');

const row = (paymentPurpose: string, amount: { debit?: number; credit?: number }): ParsedTransaction => ({
  transactionDate: new Date(2021, 5, 30),
  paymentPurpose,
  counterpartyName: paymentPurpose,
  currency: 'AUD',
  ...amount,
});

describe('HeritageParser', () => {
  it('knows its statement by the bank name and its ABN', () => {
    expect(isHeritageStatement(STATEMENT)).toBe(true);
    expect(isHeritageStatement('Transfer to Heritage Bank Limited')).toBe(false);
  });

  it('parses its files under its own bank or OTHER, and PDFs only', async () => {
    const parser = new HeritageParser();
    const claims = (bank: BankName, type = FileType.PDF) =>
      parser.canParse(bank, type, 'x.pdf', STATEMENT);
    await expect(claims(BankName.HERITAGE)).resolves.toBe(true);
    await expect(claims(BankName.OTHER)).resolves.toBe(true);
    await expect(claims(BankName.BENDIGO)).resolves.toBe(false);
    await expect(claims(BankName.HERITAGE, FileType.CSV)).resolves.toBe(false);
  });

  it.each([
    ['POS purchase at ACME STORE', { debit: 953 }, 'ACME STORE', 'card'],
    ['Refund of POS purchase at ACME STORE', { credit: 85 }, 'ACME STORE', 'card'],
    ['Interest debit comprised of:', { debit: 1.82 }, 'Interest debit comprised of:', 'interest'],
  ])('reads %s', (purpose, amount, payee, paymentType) => {
    expect(heritageEntry(row(purpose, amount))).toMatchObject({ counterpartyName: payee, paymentType });
  });
});
