import { BankName, FileType } from '@/entities/statement.entity';
import type { ParsedTransaction } from '@/modules/parsing/interfaces/parsed-statement.interface';
import { IciciParser, iciciEntry, isIciciStatement } from '@/modules/parsing/parsers/icici.parser';

const STATEMENT = [
  'Visit www.icicibank.com',
  'Statement of Transactions in Savings Account Number: 100000000001 in INR',
].join('\n');

const row = (paymentPurpose: string, amount: { debit?: number; credit?: number }): ParsedTransaction => ({
  transactionDate: new Date(2019, 3, 3),
  paymentPurpose,
  counterpartyName: paymentPurpose,
  currency: 'INR',
  ...amount,
});

describe('IciciParser', () => {
  it('knows its statement by its site and heading', () => {
    expect(isIciciStatement(STATEMENT)).toBe(true);
    expect(isIciciStatement('UPI/1/UPI/member@okicici/ICICI Bank')).toBe(false);
  });

  it('parses its files under its own bank or OTHER, and PDFs only', async () => {
    const parser = new IciciParser();
    const claims = (bank: BankName, type = FileType.PDF) =>
      parser.canParse(bank, type, 'x.pdf', STATEMENT);
    await expect(claims(BankName.ICICI)).resolves.toBe(true);
    await expect(claims(BankName.OTHER)).resolves.toBe(true);
    await expect(claims(BankName.HDFC)).resolves.toBe(false);
    await expect(claims(BankName.ICICI, FileType.CSV)).resolves.toBe(false);
  });

  it.each([
    ['UPI/909319915190/UPI/member@okbank/Sample Bank Of I/', { debit: 1600 }, 'member@okbank', 'bank_transfer_out'],
    ['MMT/IMPS/909318812658/ACME HAIR/SAMPLE BANK LTD', { credit: 29600 }, 'ACME HAIR', 'bank_transfer_in'],
    ['VPS/ACME STORE /201904021337/909208028740/SAMPLETOWN', { debit: 4377 }, 'ACME STORE', 'card'],
  ])('reads %s', (purpose, amount, payee, paymentType) => {
    expect(iciciEntry(row(purpose, amount))).toMatchObject({ counterpartyName: payee, paymentType });
  });
});
