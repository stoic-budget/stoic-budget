import { BankName, FileType } from '@/entities/statement.entity';
import type { ParsedTransaction } from '@/modules/parsing/interfaces/parsed-statement.interface';
import { SogexiaParser, isSogexiaStatement, sogexiaEntry } from '@/modules/parsing/parsers/sogexia.parser';

const STATEMENT = ['ACCOUNT STATEMENT N°10 ON', 'IBAN GB00 SAMP 0000 1000 0000 01', 'support@sogexia.com | www.sogexia.com'].join('\n');

const row = (paymentPurpose: string, amount: { debit?: number; credit?: number }): ParsedTransaction => ({
  transactionDate: new Date(2023, 10, 15),
  paymentPurpose,
  counterpartyName: paymentPurpose,
  currency: 'EUR',
  ...amount,
});

describe('SogexiaParser', () => {
  it('knows its statement by its site and title', () => {
    expect(isSogexiaStatement(STATEMENT)).toBe(true);
    expect(isSogexiaStatement('Payment to www.sogexia.com')).toBe(false);
  });

  it('parses its files under its own bank or OTHER, and PDFs only', async () => {
    const parser = new SogexiaParser();
    const claims = (bank: BankName, type = FileType.PDF) =>
      parser.canParse(bank, type, 'x.pdf', STATEMENT);
    await expect(claims(BankName.SOGEXIA)).resolves.toBe(true);
    await expect(claims(BankName.OTHER)).resolves.toBe(true);
    await expect(claims(BankName.SOCIETE_GENERALE)).resolves.toBe(false);
    await expect(claims(BankName.SOGEXIA, FileType.CSV)).resolves.toBe(false);
  });

  it.each([
    ['INSTANT TRANSFER Member One IBAN: GB00SAMP00001000000001', { credit: 116.99 }, 'Member One', 'bank_transfer_in'],
    ['FEES Load', { debit: 0.04 }, 'FEES Load', 'fee'],
    ['Credit card load 400000xxxxxx1000', { credit: 1.5 }, 'Credit card load 400000xxxxxx1000', 'bank_transfer_in'],
  ])('reads %s', (purpose, amount, payee, paymentType) => {
    expect(sogexiaEntry(row(purpose, amount))).toMatchObject({ counterpartyName: payee, paymentType });
  });
});
