import { BankName, FileType } from '@/entities/statement.entity';
import type { ParsedTransaction } from '@/modules/parsing/interfaces/parsed-statement.interface';
import {
  ComericaParser,
  comericaEntry,
  isComericaStatement,
} from '@/modules/parsing/parsers/comerica.parser';

const STATEMENT = [
  'Your Example Access Checking statement',
  'Visit our web site',
  'www.comerica.com',
  'Details of your Comerica Access Checking account: XXXXXX1234',
].join('\n');

const row = (paymentPurpose: string, amount: { debit?: number; credit?: number }): ParsedTransaction => ({
  transactionDate: new Date(2024, 8, 3),
  paymentPurpose,
  counterpartyName: paymentPurpose,
  currency: 'USD',
  ...amount,
});

describe('ComericaParser', () => {
  it('knows its statement by the web address and the details heading', () => {
    expect(isComericaStatement(STATEMENT)).toBe(true);
    expect(isComericaStatement('Payment to www.comerica.com')).toBe(false);
    expect(isComericaStatement('Details of your Comerica Access Checking account')).toBe(false);
  });

  it('parses its files under its own bank or OTHER, and PDFs only', async () => {
    const parser = new ComericaParser();
    const claims = (bank: BankName, type = FileType.PDF) =>
      parser.canParse(bank, type, 'x.pdf', STATEMENT);
    await expect(claims(BankName.COMERICA)).resolves.toBe(true);
    await expect(claims(BankName.OTHER)).resolves.toBe(true);
    await expect(claims(BankName.CITIZENS)).resolves.toBe(false);
    await expect(claims(BankName.COMERICA, FileType.CSV)).resolves.toBe(false);
  });

  it('splits the bank reference off a card entry, and the card digits off its payee', () => {
    const entry = comericaEntry(row('ACME Store Springfield IL 1234 MS10800001', { debit: 12.5 }));
    expect(entry).toMatchObject({
      paymentPurpose: 'ACME Store Springfield IL 1234',
      counterpartyName: 'ACME Store Springfield IL',
      documentNumber: 'MS10800001',
      paymentType: 'card',
    });
  });

  it('keeps a reference printed in two pieces whole', () => {
    expect(comericaEntry(row('ACME Store Springfield IL 1234 MS0120 0', { credit: 5 }))).toMatchObject({
      paymentPurpose: 'ACME Store Springfield IL 1234',
      documentNumber: 'MS0120 0',
      paymentType: 'card',
    });
  });

  it.each([
    ['Foreign Fee ACME Store Springfield IL 1234 MS01200001', { debit: 0.5 }, 'fee'],
    ['W/D At Example Branch #1 1234 MA10800001', { debit: 100 }, 'cash'],
    ['Zelle Member One ZPD0000001', { debit: 50 }, 'bank_transfer_out'],
    ['Example Payroll Pmts Aug 24 1000000001', { credit: 400 }, 'bank_transfer_in'],
    ['Example Mobile Svc 240904 1000000002', { debit: 70 }, 'direct_debit'],
  ])('types %s', (purpose, amount, paymentType) => {
    expect(comericaEntry(row(purpose, amount)).paymentType).toBe(paymentType);
  });

  it('names the other party of a Zelle payment', () => {
    expect(comericaEntry(row('Zelle Member One ZPD0000001', { debit: 50 })).counterpartyName).toBe(
      'Member One',
    );
  });
});
