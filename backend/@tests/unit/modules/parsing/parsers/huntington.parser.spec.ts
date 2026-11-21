import type { PdfTextRow } from '@/common/utils/pdf-parser.util';
import { BankName, FileType } from '@/entities/statement.entity';
import type { ParsedTransaction } from '@/modules/parsing/interfaces/parsed-statement.interface';
import {
  HuntingtonParser,
  huntingtonChecks,
  huntingtonEntry,
  isHuntingtonStatement,
} from '@/modules/parsing/parsers/huntington.parser';

const STATEMENT = ['THE HUNTINGTON NATIONAL BANK', 'Huntington Relationship Summary'].join('\n');
const line = (y: number, text: string): PdfTextRow => ({ page: 1, y, text, items: [] });

const row = (paymentPurpose: string, amount: { debit?: number; credit?: number }): ParsedTransaction => ({
  transactionDate: new Date(2019, 10, 12),
  paymentPurpose,
  counterpartyName: paymentPurpose,
  currency: 'USD',
  ...amount,
});

describe('HuntingtonParser', () => {
  it('knows its statement by the bank and its summary heading', () => {
    expect(isHuntingtonStatement(STATEMENT)).toBe(true);
    expect(isHuntingtonStatement('Huntington Bank transfer')).toBe(false);
  });

  it('parses its files under its own bank or OTHER, and PDFs only', async () => {
    const parser = new HuntingtonParser();
    const claims = (bank: BankName, type = FileType.PDF) =>
      parser.canParse(bank, type, 'x.pdf', STATEMENT);
    await expect(claims(BankName.HUNTINGTON)).resolves.toBe(true);
    await expect(claims(BankName.OTHER)).resolves.toBe(true);
    await expect(claims(BankName.CHASE)).resolves.toBe(false);
    await expect(claims(BankName.HUNTINGTON, FileType.CSV)).resolves.toBe(false);
  });

  it('reads the checks paid, two to a line, with the day paid after the amount', () => {
    const checks = huntingtonChecks([
      line(10, 'Check Activity (-) Account: 10000001'),
      line(20, 'Check # Amount Date Paid Check # Amount Date Paid'),
      line(30, '727068 3,000.00 11/25 727069* 12.50 11/27'),
      line(40, 'ATM Withdrawal Activity (-) Account: 10000001'),
      line(50, '11/25 ACME CASH WITHDRAWAL 304.99'),
    ]);
    expect(checks.map(check => [check.description, check.debit, check.dateText, check.account?.accountNumber])).toEqual([
      ['CHECK 727068', 3000, '11/25', '10000001'],
      ['CHECK 727069', 12.5, '11/27', '10000001'],
    ]);
  });

  it.each([
    ['PURCHASE ACME LIQUOR ACME LIQUOR SAMPLETOWN MI 1000000000001000', { debit: 14.27 }, 'ACME LIQUOR ACME LIQUOR SAMPLETOWN MI', 'card'],
    ['INTERNET TFR FRM SAVINGS 110719 1000000002', { credit: 1100 }, 'INTERNET TFR FRM SAVINGS 110719 1000000002', 'bank_transfer_in'],
  ])('reads %s', (purpose, amount, payee, paymentType) => {
    expect(huntingtonEntry(row(purpose, amount))).toMatchObject({ counterpartyName: payee, paymentType });
  });
});
