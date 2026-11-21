import { BankName, FileType } from '@/entities/statement.entity';
import type { ParsedTransaction } from '@/modules/parsing/interfaces/parsed-statement.interface';
import { FnbParser, fnbEntry, isFnbStatement } from '@/modules/parsing/parsers/fnb.parser';

const STATEMENT = ['9 fnb.co.za', 'FNB Aspire Current Account : 62000000108', 'Transactions in RAND (ZAR)'].join(
  '\n',
);

const row = (paymentPurpose: string, amount: { debit?: number; credit?: number }): ParsedTransaction => ({
  transactionDate: new Date(2023, 6, 4),
  paymentPurpose,
  counterpartyName: paymentPurpose,
  currency: 'ZAR',
  ...amount,
});

describe('FnbParser', () => {
  it('knows its statement by the site and the account line', () => {
    expect(isFnbStatement(STATEMENT)).toBe(true);
    expect(isFnbStatement('Magtape Credit FNB')).toBe(false);
  });

  it('parses its files under its own bank or OTHER, and PDFs only', async () => {
    const parser = new FnbParser();
    const claims = (bank: BankName, type = FileType.PDF) =>
      parser.canParse(bank, type, 'x.pdf', STATEMENT);
    await expect(claims(BankName.FNB)).resolves.toBe(true);
    await expect(claims(BankName.OTHER)).resolves.toBe(true);
    await expect(claims(BankName.ABSA)).resolves.toBe(false);
    await expect(claims(BankName.FNB, FileType.CSV)).resolves.toBe(false);
  });

  it.each([
    ['POS Purchase ACME Store Sampletown 400000*1000 01 Jul', { debit: 206.69 }, 'ACME Store Sampletown', 'card'],
    ['FNB App Payment To Member Two', { debit: 200 }, 'Member Two', 'bank_transfer_out'],
    ['FNB App Payment From Donation', { credit: 2500 }, 'Donation', 'bank_transfer_in'],
    ['Rtc Credit Member Three 06E18D2700', { credit: 250 }, 'Member Three 06E18D2700', 'bank_transfer_in'],
    ['#Service Fees', { debit: 4.4 }, '#Service Fees', 'fee'],
  ])('reads %s', (purpose, amount, payee, paymentType) => {
    expect(fnbEntry(row(purpose, amount))).toMatchObject({ counterpartyName: payee, paymentType });
  });
});
