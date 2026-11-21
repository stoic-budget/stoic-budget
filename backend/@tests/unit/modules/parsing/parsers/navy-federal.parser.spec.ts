import type { PdfTextRow } from '@/common/utils/pdf-parser.util';
import { BankName, FileType } from '@/entities/statement.entity';
import type { ParsedTransaction } from '@/modules/parsing/interfaces/parsed-statement.interface';
import {
  NavyFederalParser,
  isNavyFederalStatement,
  navyFederalEntry,
  withoutItemsPaid,
} from '@/modules/parsing/parsers/navy-federal.parser';

const STATEMENT = ['Statement of Account', 'Navy Federal Online Banking', 'Visit navyfederal.org'].join('\n');

const line = (y: number, text: string): PdfTextRow => ({
  page: 1,
  y,
  text,
  items: text.split(' ').map((word, index) => ({ text: word, x: index * 40, y, width: 30, height: 8, page: 1 })),
});

const row = (paymentPurpose: string, amount: { debit?: number; credit?: number }): ParsedTransaction => ({
  transactionDate: new Date(2021, 5, 28),
  paymentPurpose,
  counterpartyName: paymentPurpose,
  currency: 'USD',
  ...amount,
});

describe('NavyFederalParser', () => {
  it('knows its statement by its name and web address', () => {
    expect(isNavyFederalStatement(STATEMENT)).toBe(true);
    expect(isNavyFederalStatement('Transfer to Navy Federal')).toBe(false);
  });

  it('parses its files under its own bank or OTHER, and PDFs only', async () => {
    const parser = new NavyFederalParser();
    const claims = (bank: BankName, type = FileType.PDF) =>
      parser.canParse(bank, type, 'x.pdf', STATEMENT);
    await expect(claims(BankName.NAVY_FEDERAL)).resolves.toBe(true);
    await expect(claims(BankName.OTHER)).resolves.toBe(true);
    await expect(claims(BankName.DISCOVER)).resolves.toBe(false);
    await expect(claims(BankName.NAVY_FEDERAL, FileType.CSV)).resolves.toBe(false);
  });

  it('leaves "Items Paid" out up to the next account', () => {
    const rows = withoutItemsPaid([
      line(10, '07-26 ATM Rebate 4.50 2,710.70'),
      line(20, 'Items Paid'),
      line(30, '06-29 ACH 715.50 07-06 POS 40.00'),
      line(40, 'Savings'),
      line(50, '06-30 Dividend 0.02 6.02'),
    ]);
    expect(rows.map(kept => kept.text)).toEqual(['07-26 ATM Rebate 4.50 2,710.70', 'Savings', '06-30 Dividend 0.02 6.02']);
  });

  it.each([
    ['POS Debit- Debit Card 1000 06-26-21 ACME Store Sampletown CA', { debit: 8.61 }, 'ACME Store Sampletown CA', 'card'],
    ['Deposit - ACH Paid From ACME Payroll 01Afd2', { credit: 432.48 }, 'ACME Payroll', 'bank_transfer_in'],
    ['Dividend', { credit: 0.07 }, 'Dividend', 'interest'],
  ])('reads %s', (purpose, amount, payee, paymentType) => {
    expect(navyFederalEntry(row(purpose, amount))).toMatchObject({ counterpartyName: payee, paymentType });
  });
});
