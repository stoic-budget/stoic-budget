import { BankName, FileType } from '@/entities/statement.entity';
import type { ParsedTransaction } from '@/modules/parsing/interfaces/parsed-statement.interface';
import { SuncorpParser, isSuncorpStatement, suncorpEntry } from '@/modules/parsing/parsers/suncorp.parser';

const STATEMENT = ['Account Transactions', 'Suncorp-Metway Ltd ABN 66 010 831 722 AFSL No 229882'].join('\n');

const row = (paymentPurpose: string, amount: { debit?: number; credit?: number }): ParsedTransaction => ({
  transactionDate: new Date(2025, 5, 1),
  paymentPurpose,
  counterpartyName: paymentPurpose,
  currency: 'AUD',
  ...amount,
});

describe('SuncorpParser', () => {
  it('knows its statement by its legal line and transactions title', () => {
    expect(isSuncorpStatement(STATEMENT)).toBe(true);
    expect(isSuncorpStatement('Transfer to Suncorp-Metway Ltd')).toBe(false);
  });

  it('parses its files under its own bank or OTHER, and PDFs only', async () => {
    const parser = new SuncorpParser();
    const claims = (bank: BankName, type = FileType.PDF) =>
      parser.canParse(bank, type, 'x.pdf', STATEMENT);
    await expect(claims(BankName.SUNCORP)).resolves.toBe(true);
    await expect(claims(BankName.OTHER)).resolves.toBe(true);
    await expect(claims(BankName.NAB)).resolves.toBe(false);
    await expect(claims(BankName.SUNCORP, FileType.CSV)).resolves.toBe(false);
  });

  it.each([
    ['OSKO PAYMENT TO MEMB SAMPLESON THANKS MATE. REF NO 1000', { debit: 350 }, 'MEMB SAMPLESON', 'bank_transfer_out'],
    ['OSKO PAYMENT FROM ACME CONSTRUCTIONS Salary REF NO 1000', { credit: 613 }, 'ACME CONSTRUCTIONS', 'bank_transfer_in'],
    ['VISA PURCHASE ACME STORE 1624 SAMPLETOWN 03/04 AU AUD', { debit: 4.8 }, 'ACME STORE 1624 SAMPLETOWN', 'card'],
  ])('reads %s', (purpose, amount, payee, paymentType) => {
    expect(suncorpEntry(row(purpose, amount))).toMatchObject({ counterpartyName: payee, paymentType });
  });
});
