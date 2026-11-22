import { BankName, FileType } from '@/entities/statement.entity';
import type { ParsedTransaction } from '@/modules/parsing/interfaces/parsed-statement.interface';
import { NetspendParser, isNetspendStatement, netspendEntry } from '@/modules/parsing/parsers/netspend.parser';

const STATEMENT = ['WebSite: www.netspend.com', 'Account Summary April 30, 2020. Account Number, 00001000000001', 'Your Transaction Details'].join('\n');

const row = (paymentPurpose: string, amount: { debit?: number; credit?: number }): ParsedTransaction => ({
  transactionDate: new Date(2020, 3, 10),
  paymentPurpose,
  counterpartyName: paymentPurpose,
  currency: 'USD',
  ...amount,
});

describe('NetspendParser', () => {
  it('knows its statement by its web address and details table', () => {
    expect(isNetspendStatement(STATEMENT)).toBe(true);
    expect(isNetspendStatement('Load from netspend.com')).toBe(false);
  });

  it('parses its files under its own bank or OTHER, and PDFs only', async () => {
    const parser = new NetspendParser();
    const claims = (bank: BankName, type = FileType.PDF) =>
      parser.canParse(bank, type, 'x.pdf', STATEMENT);
    await expect(claims(BankName.NETSPEND)).resolves.toBe(true);
    await expect(claims(BankName.OTHER)).resolves.toBe(true);
    await expect(claims(BankName.GREEN_DOT)).resolves.toBe(false);
    await expect(claims(BankName.NETSPEND, FileType.CSV)).resolves.toBe(false);
  });

  it.each([
    ['ATM', { debit: 200 }, 'cash'],
    ['Payroll', { credit: 2100 }, 'bank_transfer_in'],
    ['Direct debit', { debit: 200 }, 'direct_debit'],
  ])('types %s', (purpose, amount, paymentType) => {
    expect(netspendEntry(row(purpose, amount)).paymentType).toBe(paymentType);
  });
});
