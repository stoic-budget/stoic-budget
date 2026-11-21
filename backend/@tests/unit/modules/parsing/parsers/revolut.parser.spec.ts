import type { PdfTextRow } from '@/common/utils/pdf-parser.util';
import { BankName, FileType } from '@/entities/statement.entity';
import type { ParsedTransaction } from '@/modules/parsing/interfaces/parsed-statement.interface';
import {
  RevolutParser,
  isRevolutStatement,
  revolutBalances,
  revolutEntry,
  withoutRevertedRows,
} from '@/modules/parsing/parsers/revolut.parser';

const STATEMENT = [
  'Account transactions from 1 April 2024 to 30 April 2024',
  'Revolut Ltd (No. 00000000) is authorised by the Financial Conduct Authority',
].join('\n');

const line = (y: number, text: string): PdfTextRow => ({ page: 1, y, text, items: [] });

const row = (paymentPurpose: string, amount: { debit?: number; credit?: number }): ParsedTransaction => ({
  transactionDate: new Date(2024, 3, 8),
  paymentPurpose,
  counterpartyName: paymentPurpose,
  currency: 'GBP',
  ...amount,
});

describe('RevolutParser', () => {
  it('knows its statement by its legal line and transactions title', () => {
    expect(isRevolutStatement(STATEMENT)).toBe(true);
    expect(isRevolutStatement('Payment from Revolut Ltd')).toBe(false);
  });

  it('parses its files under its own bank or OTHER, and PDFs only', async () => {
    const parser = new RevolutParser();
    const claims = (bank: BankName, type = FileType.PDF) =>
      parser.canParse(bank, type, 'x.pdf', STATEMENT);
    await expect(claims(BankName.REVOLUT)).resolves.toBe(true);
    await expect(claims(BankName.OTHER)).resolves.toBe(true);
    await expect(claims(BankName.MONZO)).resolves.toBe(false);
    await expect(claims(BankName.REVOLUT, FileType.CSV)).resolves.toBe(false);
  });

  it('takes the balances from the summary total and leaves reverted payments out', () => {
    expect(revolutBalances('Total £0.44 £2,843.36 £3,770.00 £927.08\n')).toEqual({ start: 0.44, end: 927.08 });
    const rows = withoutRevertedRows([
      line(10, '30 Apr 2024 ACME £30.00 £927.08'),
      line(20, 'Reverted from 1 April 2024 to 30 April 2024'),
      line(30, '22 Apr 2024 ACME Finance £711.87'),
    ]);
    expect(rows.map(kept => kept.text)).toEqual(['30 Apr 2024 ACME £30.00 £927.08']);
  });

  it.each([
    ['Payment from Member One From: MEMBER ONE, 10000001', { credit: 200 }, 'Member One', 'bank_transfer_in'],
    ['To Member Two To: Member Two, 10000002 (GB)', { debit: 50 }, 'Member Two', 'bank_transfer_out'],
    ['ACME To: Acme Shop, London Card: 400000******1000', { debit: 8.5 }, 'ACME', 'card'],
    ['Premium plan fee', { debit: 7.99 }, 'Premium plan fee', 'fee'],
  ])('reads %s', (purpose, amount, payee, paymentType) => {
    expect(revolutEntry(row(purpose, amount))).toMatchObject({ counterpartyName: payee, paymentType });
  });
});
