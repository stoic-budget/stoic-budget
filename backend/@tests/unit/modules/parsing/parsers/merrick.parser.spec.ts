import { BankName, FileType } from '@/entities/statement.entity';
import type { ParsedTransaction } from '@/modules/parsing/interfaces/parsed-statement.interface';
import { MerrickParser, isMerrickStatement, merrickEntry } from '@/modules/parsing/parsers/merrick.parser';

const STATEMENT = ['Send Payments to:', 'MERRICK BANK', 'MERRICK ACCOUNT SUMMARY'].join('\n');

const row = (paymentPurpose: string, amount: { debit?: number; credit?: number }): ParsedTransaction => ({
  transactionDate: new Date(2020, 11, 18),
  paymentPurpose,
  counterpartyName: paymentPurpose,
  currency: 'USD',
  ...amount,
});

describe('MerrickParser', () => {
  it('knows its statement by the bank and its summary', () => {
    expect(isMerrickStatement(STATEMENT)).toBe(true);
    expect(isMerrickStatement('Payment to MERRICK BANK')).toBe(false);
  });

  it('parses its files under its own bank or OTHER, and PDFs only', async () => {
    const parser = new MerrickParser();
    const claims = (bank: BankName, type = FileType.PDF) =>
      parser.canParse(bank, type, 'x.pdf', STATEMENT);
    await expect(claims(BankName.MERRICK)).resolves.toBe(true);
    await expect(claims(BankName.OTHER)).resolves.toBe(true);
    await expect(claims(BankName.DISCOVER)).resolves.toBe(false);
    await expect(claims(BankName.MERRICK, FileType.CSV)).resolves.toBe(false);
  });

  it('takes the reference number off a purchase', () => {
    const entry = merrickEntry(row('1000000ABCD1234EF ACME STORE 800-555-0100 CA', { debit: 13.98 }));
    expect(entry).toMatchObject({
      documentNumber: '1000000ABCD1234EF',
      counterpartyName: 'ACME STORE 800-555-0100 CA',
      paymentType: 'card',
    });
  });

  it.each([
    ['LATE FEE', 'fee'],
    ['Interest Charge on Purchases', 'interest'],
  ])('types %s', (purpose, paymentType) => {
    expect(merrickEntry(row(purpose, { debit: 40 })).paymentType).toBe(paymentType);
  });
});
