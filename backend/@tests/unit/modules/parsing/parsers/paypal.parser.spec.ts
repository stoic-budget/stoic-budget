import { BankName, FileType } from '@/entities/statement.entity';
import type { ParsedTransaction } from '@/modules/parsing/interfaces/parsed-statement.interface';
import { PaypalParser, isPaypalStatement, paypalEntry } from '@/modules/parsing/parsers/paypal.parser';

const STATEMENT = ['PayPal Savings Statement', 'Statement Period PayPal Account ID Name', 'member-1@example.com'].join('\n');

const row = (paymentPurpose: string, amount: { debit?: number; credit?: number }): ParsedTransaction => ({
  transactionDate: new Date(2023, 9, 15),
  paymentPurpose,
  counterpartyName: paymentPurpose,
  currency: 'USD',
  ...amount,
});

describe('PaypalParser', () => {
  it('knows its statement by its title and account ID label', () => {
    expect(isPaypalStatement(STATEMENT)).toBe(true);
    expect(isPaypalStatement('Payment to PayPal Account ID 1')).toBe(false);
  });

  it('parses its files under its own bank or OTHER, and PDFs only', async () => {
    const parser = new PaypalParser();
    const claims = (bank: BankName, type = FileType.PDF) =>
      parser.canParse(bank, type, 'x.pdf', STATEMENT);
    await expect(claims(BankName.PAYPAL)).resolves.toBe(true);
    await expect(claims(BankName.OTHER)).resolves.toBe(true);
    await expect(claims(BankName.PAYONEER)).resolves.toBe(false);
    await expect(claims(BankName.PAYPAL, FileType.CSV)).resolves.toBe(false);
  });

  it.each([
    ['Interest paid', { credit: 0.41 }, 'interest'],
    ['Transfer from PayPal balance', { credit: 50 }, 'bank_transfer_in'],
    ['Withdrawal to PayPal balance', { debit: 20 }, 'bank_transfer_out'],
  ])('types %s', (purpose, amount, paymentType) => {
    expect(paypalEntry(row(purpose, amount)).paymentType).toBe(paymentType);
  });
});
