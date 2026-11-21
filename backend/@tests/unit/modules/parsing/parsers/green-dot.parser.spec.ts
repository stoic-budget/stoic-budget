import { BankName, FileType } from '@/entities/statement.entity';
import type { ParsedTransaction } from '@/modules/parsing/interfaces/parsed-statement.interface';
import { GreenDotParser, greenDotEntry, isGreenDotStatement } from '@/modules/parsing/parsers/green-dot.parser';

const STATEMENT = ['TRANSACTIONS', 'web www.greendot.com', '©2013 - 2016 Green Dot Corporation'].join('\n');

const row = (paymentPurpose: string, amount: { debit?: number; credit?: number }): ParsedTransaction => ({
  transactionDate: new Date(2018, 7, 16),
  paymentPurpose,
  counterpartyName: paymentPurpose,
  currency: 'USD',
  ...amount,
});

describe('GreenDotParser', () => {
  it('knows its statement by the company line and its site', () => {
    expect(isGreenDotStatement(STATEMENT)).toBe(true);
    expect(isGreenDotStatement('GREEN DOT RELOAD')).toBe(false);
  });

  it('parses its files under its own bank or OTHER, and PDFs only', async () => {
    const parser = new GreenDotParser();
    const claims = (bank: BankName, type = FileType.PDF) =>
      parser.canParse(bank, type, 'x.pdf', STATEMENT);
    await expect(claims(BankName.GREEN_DOT)).resolves.toBe(true);
    await expect(claims(BankName.OTHER)).resolves.toBe(true);
    await expect(claims(BankName.GO2BANK)).resolves.toBe(false);
    await expect(claims(BankName.GREEN_DOT, FileType.CSV)).resolves.toBe(false);
  });

  it.each([
    ['ATM Withdrawal Fee Fee', { debit: 2.5 }, 'fee'],
    ['ACME ATM SAMPLETOWN ATM Withdrawal BEACH A', { debit: 368 }, 'cash'],
    ['DD:ACME - BILLPAY Direct Deposit', { credit: 800 }, 'bank_transfer_in'],
  ])('types %s by its Type column', (purpose, amount, paymentType) => {
    expect(greenDotEntry(row(purpose, amount)).paymentType).toBe(paymentType);
  });
});
