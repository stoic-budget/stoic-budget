import { BankName, FileType } from '@/entities/statement.entity';
import type { ParsedTransaction } from '@/modules/parsing/interfaces/parsed-statement.interface';
import {
  CreditOneParser,
  creditOneEntry,
  isCreditOneStatement,
} from '@/modules/parsing/parsers/credit-one.parser';

const STATEMENT = [
  'CREDIT ONE BANK CREDIT CARD STATEMENT',
  'Account Number 0000 000000 00001',
  'PAY YOUR BILL ONLINE at CreditOneBank.com',
].join('\n');

const row = (paymentPurpose: string, amount: { debit?: number; credit?: number }): ParsedTransaction => ({
  transactionDate: new Date(2022, 7, 5),
  paymentPurpose,
  counterpartyName: paymentPurpose,
  currency: 'USD',
  ...amount,
});

describe('CreditOneParser', () => {
  it('knows its statement by its title and the web address', () => {
    expect(isCreditOneStatement(STATEMENT)).toBe(true);
    expect(isCreditOneStatement('Payment to CreditOneBank.com')).toBe(false);
  });

  it('parses its files under its own bank or OTHER, and PDFs only', async () => {
    const parser = new CreditOneParser();
    const claims = (bank: BankName, type = FileType.PDF) =>
      parser.canParse(bank, type, 'x.pdf', STATEMENT);
    await expect(claims(BankName.CREDIT_ONE)).resolves.toBe(true);
    await expect(claims(BankName.OTHER)).resolves.toBe(true);
    await expect(claims(BankName.CREDIT_AGRICOLE)).resolves.toBe(false);
    await expect(claims(BankName.CREDIT_ONE, FileType.CSV)).resolves.toBe(false);
  });

  it.each([
    ['PAYMENT THANK YOU (ARC) SAMPLETOWN NV', { credit: 1500 }, 'bank_transfer_in'],
    ['Interest Charge on Purchases', { debit: 12.5 }, 'interest'],
    ['CREDIT PROTECT 1-800-000-0000', { debit: 1.93 }, 'fee'],
    ['ACME STORE SAMPLETOWN WA', { debit: 192.28 }, 'card'],
  ])('types %s', (purpose, amount, paymentType) => {
    expect(creditOneEntry(row(purpose, amount)).paymentType).toBe(paymentType);
  });

  it('leaves adjustments and refunds, which go either way, untyped', () => {
    expect(creditOneEntry(row('AN ADJ TO YOUR ACCOUNT SAMPLETOWN NV', { debit: 583.04 })).paymentType).toBeUndefined();
    expect(creditOneEntry(row('REVERSE CREDIT REFUND SAMPLETOWN', { credit: 583.04 })).paymentType).toBeUndefined();
  });
});
