import { BankName, FileType } from '@/entities/statement.entity';
import type { ParsedTransaction } from '@/modules/parsing/interfaces/parsed-statement.interface';
import {
  WalmartMoneyCardParser,
  debitAccountEnd,
  isWalmartMoneyCardStatement,
  walmartMoneyCardEntry,
} from '@/modules/parsing/parsers/walmart-moneycard.parser';

const STATEMENT = ['DEBIT ACCOUNT TRANSACTIONS', 'CONTACT US', 'web www.WalmartMoneyCard.com'].join('\n');

const row = (paymentPurpose: string, amount: { debit?: number; credit?: number }): ParsedTransaction => ({
  transactionDate: new Date(2022, 1, 3),
  paymentPurpose,
  counterpartyName: paymentPurpose,
  currency: 'USD',
  ...amount,
});

describe('WalmartMoneyCardParser', () => {
  it('knows its statement by its web address and debit account table', () => {
    expect(isWalmartMoneyCardStatement(STATEMENT)).toBe(true);
    expect(isWalmartMoneyCardStatement('Load at www.WalmartMoneyCard.com')).toBe(false);
  });

  it('parses its files under its own bank or OTHER, and PDFs only', async () => {
    const parser = new WalmartMoneyCardParser();
    const claims = (bank: BankName, type = FileType.PDF) =>
      parser.canParse(bank, type, 'x.pdf', STATEMENT);
    await expect(claims(BankName.WALMART_MONEYCARD)).resolves.toBe(true);
    await expect(claims(BankName.OTHER)).resolves.toBe(true);
    await expect(claims(BankName.GREEN_DOT)).resolves.toBe(false);
    await expect(claims(BankName.WALMART_MONEYCARD, FileType.CSV)).resolves.toBe(false);
  });

  it('works out the debit account\'s ending balance from its summary', () => {
    const text = 'Credits (4) +$1.57\nDebits (1) -$5.94\nEnding Balance: $0.00';
    expect(debitAccountEnd(text, 0)).toBe(-4.37);
  });

  it('reads the party before the type', () => {
    expect(walmartMoneyCardEntry(row('ACME NETWORK Deposit ACME PMT', { credit: 0.43 }))).toMatchObject({
      counterpartyName: 'ACME NETWORK',
      paymentType: 'bank_transfer_in',
    });
  });
});
