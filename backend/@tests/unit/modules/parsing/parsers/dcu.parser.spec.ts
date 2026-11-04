import { BankName, FileType } from '@/entities/statement.entity';
import type { ParsedTransaction } from '@/modules/parsing/interfaces/parsed-statement.interface';
import { DcuParser, dcuEntry, isDcuStatement } from '@/modules/parsing/parsers/dcu.parser';

const STATEMENT = [
  'Account Statement',
  'MEMBER # STATEMENT PERIOD PAGE',
  'BANKING – THE DCU WAY 1000001 01-01-21 to 01-31-21 1 of 1',
  'Digital Federal Credit Union',
].join('\n');

const row = (paymentPurpose: string, amount: { debit?: number; credit?: number }): ParsedTransaction => ({
  transactionDate: new Date(2021, 0, 5),
  paymentPurpose,
  counterpartyName: paymentPurpose,
  currency: 'USD',
  ...amount,
});

describe('DcuParser', () => {
  it('knows its statement by the credit union name and the member number', () => {
    expect(isDcuStatement(STATEMENT)).toBe(true);
    expect(isDcuStatement('Digital Federal Credit Union')).toBe(false);
  });

  it('parses its files under its own bank or OTHER, and PDFs only', async () => {
    const parser = new DcuParser();
    const claims = (bank: BankName, type = FileType.PDF) =>
      parser.canParse(bank, type, 'x.pdf', STATEMENT);
    await expect(claims(BankName.DCU)).resolves.toBe(true);
    await expect(claims(BankName.OTHER)).resolves.toBe(true);
    await expect(claims(BankName.CREDIT_ONE)).resolves.toBe(false);
    await expect(claims(BankName.DCU, FileType.CSV)).resolves.toBe(false);
  });

  it.each([
    ['TRANSFER 1000002 FROM/TO 1', { credit: 600 }, 'bank_transfer_in'],
    ['TRANSFER 1000002 FROM/TO 1', { debit: 600 }, 'bank_transfer_out'],
    ['DEPOSIT Example Cash Back Deposit', { credit: 16.53 }, 'bank_transfer_in'],
    ['DIVIDEND', { credit: 8.3 }, 'interest'],
    ['PAYMENT SHR TRANSFER FROM/TO 141', { debit: 1555.28 }, 'bank_transfer_out'],
    ['WITHDRAWAL ATM SAMPLETOWN', { debit: 40 }, 'cash'],
    ['POS ACME STORE', { debit: 12 }, 'card'],
    ['OVERDRAFT FEE', { debit: 30 }, 'fee'],
  ])('types %s', (purpose, amount, paymentType) => {
    expect(dcuEntry(row(purpose, amount)).paymentType).toBe(paymentType);
  });
});
