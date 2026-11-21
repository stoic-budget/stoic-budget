import { BankName, FileType } from '@/entities/statement.entity';
import type { ParsedTransaction } from '@/modules/parsing/interfaces/parsed-statement.interface';
import {
  HandelsbankenParser,
  handelsbankenEntry,
  isHandelsbankenStatement,
  lastAccountPage,
} from '@/modules/parsing/parsers/handelsbanken.parser';

const STATEMENT = ['Handelsbanken', 'STATEMENT OF ACCOUNT', 'Handelsbanken is the trading name of Handelsbanken plc'].join(
  '\n',
);

const row = (paymentPurpose: string, amount: { debit?: number; credit?: number }): ParsedTransaction => ({
  transactionDate: new Date(2020, 10, 18),
  paymentPurpose,
  counterpartyName: paymentPurpose,
  currency: 'GBP',
  ...amount,
});

describe('HandelsbankenParser', () => {
  it('knows its statement by the bank and its UK company line', () => {
    expect(isHandelsbankenStatement(STATEMENT)).toBe(true);
    expect(isHandelsbankenStatement('Transfer from Handelsbanken')).toBe(false);
  });

  it('parses its files under its own bank or OTHER, and PDFs only', async () => {
    const parser = new HandelsbankenParser();
    const claims = (bank: BankName, type = FileType.PDF) =>
      parser.canParse(bank, type, 'x.pdf', STATEMENT);
    await expect(claims(BankName.HANDELSBANKEN)).resolves.toBe(true);
    await expect(claims(BankName.OTHER)).resolves.toBe(true);
    await expect(claims(BankName.BARCLAYS)).resolves.toBe(false);
    await expect(claims(BankName.HANDELSBANKEN, FileType.CSV)).resolves.toBe(false);
  });

  it.each([
    ['D.DR ACME POWER REF D0001', { debit: 309.51 }, 'ACME POWER REF D0001', 'direct_debit'],
    ['B/O MEMBER ONE HALL HIRE', { credit: 72 }, 'MEMBER ONE HALL HIRE', 'bank_transfer_in'],
  ])('reads %s', (purpose, amount, payee, paymentType) => {
    expect(handelsbankenEntry(row(purpose, amount))).toMatchObject({ counterpartyName: payee, paymentType });
  });

  it('names a cheque by its number', () => {
    expect(handelsbankenEntry(row('CHQ.002726', { debit: 4946.9 }))).toMatchObject({
      counterpartyName: 'Cheque 002726',
      documentNumber: '002726',
    });
  });

  it("takes the last account page's number and balance brought forward", () => {
    const pages = [
      'A/C NO: 10000001',
      '15NOV20 BALANCE BROUGHT FORWARD',
      '158,432.82',
      'A/C NO: 10000002',
      '16NOV20 BALANCE BROUGHT FORWARD',
      '136,659.49',
    ].join('\n');
    expect(lastAccountPage(pages)).toEqual({ account: '10000002', opening: 136659.49 });
  });
});
