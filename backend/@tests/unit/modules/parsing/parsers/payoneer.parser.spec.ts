import type { PdfTextRow } from '@/common/utils/pdf-parser.util';
import { BankName, FileType } from '@/entities/statement.entity';
import type { ParsedTransaction } from '@/modules/parsing/interfaces/parsed-statement.interface';
import {
  PayoneerParser,
  isPayoneerStatement,
  payoneerEntry,
  withoutUndoneRows,
} from '@/modules/parsing/parsers/payoneer.parser';

const STATEMENT = [
  'Transactions',
  'Date Description Amount Status',
  '© 2005-2024 Payoneer, All Rights Reserved | www.payoneer.com',
].join('\n');

const line = (text: string): PdfTextRow => ({ page: 1, y: 0, text, items: [] });

const row = (paymentPurpose: string, amount: { debit?: number; credit?: number }): ParsedTransaction => ({
  transactionDate: new Date(2024, 8, 24),
  paymentPurpose,
  counterpartyName: paymentPurpose,
  currency: 'GBP',
  ...amount,
});

describe('PayoneerParser', () => {
  it('knows its statement by its footer and table', () => {
    expect(isPayoneerStatement(STATEMENT)).toBe(true);
    expect(isPayoneerStatement('Payment from Payoneer, All Rights Reserved')).toBe(false);
  });

  it('parses its files under its own bank or OTHER, and PDFs only', async () => {
    const parser = new PayoneerParser();
    const claims = (bank: BankName, type = FileType.PDF) =>
      parser.canParse(bank, type, 'x.pdf', STATEMENT);
    await expect(claims(BankName.PAYONEER)).resolves.toBe(true);
    await expect(claims(BankName.OTHER)).resolves.toBe(true);
    await expect(claims(BankName.KROO)).resolves.toBe(false);
    await expect(claims(BankName.PAYONEER, FileType.CSV)).resolves.toBe(false);
  });

  it('leaves out payments that were canceled or failed', () => {
    const rows = withoutUndoneRows([
      line('24 Sep, 2024 Payment to Member One -40.82 GBP Completed'),
      line('23 Sep, 2024 Payment from ACME - XX-100000 (ACME LLC) 14.30 GBP Canceled'),
    ]);
    expect(rows).toHaveLength(1);
  });

  it.each([
    ['Payment from ACME Shop - XX-100000 (ACME LTD) GBP', { credit: 32.22 }, 'ACME Shop', 'bank_transfer_in'],
    ['Withdrawal to Sample Savings Bank (1000) GBP', { debit: 54.15 }, 'Sample Savings Bank', 'bank_transfer_out'],
    ['Payment to Member One GBP', { debit: 40.82 }, 'Member One', 'bank_transfer_out'],
  ])('reads %s', (purpose, amount, payee, paymentType) => {
    expect(payoneerEntry(row(purpose, amount))).toMatchObject({ counterpartyName: payee, paymentType });
  });
});
