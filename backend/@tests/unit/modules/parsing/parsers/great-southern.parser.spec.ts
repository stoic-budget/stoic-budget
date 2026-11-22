import { BankName, FileType } from '@/entities/statement.entity';
import type { ParsedTransaction } from '@/modules/parsing/interfaces/parsed-statement.interface';
import {
  GreatSouthernParser,
  greatSouthernEntry,
  isGreatSouthernStatement,
} from '@/modules/parsing/parsers/great-southern.parser';

const STATEMENT = ['Great Southern Bank', 'A business name of Credit Union Australia Limited', 'Transaction history'].join(
  '\n',
);

const row = (paymentPurpose: string, amount: { debit?: number; credit?: number }): ParsedTransaction => ({
  transactionDate: new Date(2023, 0, 23),
  paymentPurpose,
  counterpartyName: paymentPurpose,
  currency: 'AUD',
  ...amount,
});

describe('GreatSouthernParser', () => {
  it('knows its statement by the bank and the credit union behind it', () => {
    expect(isGreatSouthernStatement(STATEMENT)).toBe(true);
    expect(isGreatSouthernStatement('Great Southern Bank transfer')).toBe(false);
  });

  it('parses its files under its own bank or OTHER, and PDFs only', async () => {
    const parser = new GreatSouthernParser();
    const claims = (bank: BankName, type = FileType.PDF) =>
      parser.canParse(bank, type, 'x.pdf', STATEMENT);
    await expect(claims(BankName.GREAT_SOUTHERN)).resolves.toBe(true);
    await expect(claims(BankName.OTHER)).resolves.toBe(true);
    await expect(claims(BankName.ANZ)).resolves.toBe(false);
    await expect(claims(BankName.GREAT_SOUTHERN, FileType.CSV)).resolves.toBe(false);
  });

  it.each([
    ['Card Purchase PAYW ACME FOODSTORE SAMPLETOWN 210123', { debit: 21.8 }, 'ACME FOODSTORE SAMPLETOWN', 'card'],
    ['Intl Visa Fee', { debit: 1.71 }, 'Intl Visa Fee', 'fee'],
    ['From: Member One', { credit: 400 }, 'Member One', 'bank_transfer_in'],
    ['ePayment From:ACME PAY REF: 7D1B2276', { credit: 547.4 }, 'ACME PAY', 'bank_transfer_in'],
    ['TXN INITIATED BY-1000001 TRANSFER TO 814282 51000002 Member One', { debit: 500 }, 'Member One', 'bank_transfer_out'],
  ])('reads %s', (purpose, amount, payee, paymentType) => {
    expect(greatSouthernEntry(row(purpose, amount))).toMatchObject({ counterpartyName: payee, paymentType });
  });
});
