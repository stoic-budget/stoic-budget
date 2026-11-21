import { BankName, FileType } from '@/entities/statement.entity';
import type { ParsedTransaction } from '@/modules/parsing/interfaces/parsed-statement.interface';
import {
  BankOfAmericaParser,
  bankOfAmericaEntry,
  isBankOfAmericaStatement,
} from '@/modules/parsing/parsers/bank-of-america.parser';

const STATEMENT = [
  'Bank of America, N.A.',
  'P.O. Box 25118',
  'Your combined statement',
  'Account summary',
  'Beginning balance on July 23, 2024 $6,442.93',
].join('\n');

const row = (paymentPurpose: string, amount: { debit?: number; credit?: number }): ParsedTransaction => ({
  transactionDate: new Date(2024, 7, 2),
  paymentPurpose,
  counterpartyName: paymentPurpose,
  currency: 'USD',
  ...amount,
});

describe('BankOfAmericaParser', () => {
  it('knows its statement by the bank name and the account summary', () => {
    expect(isBankOfAmericaStatement(STATEMENT)).toBe(true);
    expect(isBankOfAmericaStatement('Transfer to Bank of America, N.A.')).toBe(false);
  });

  it('parses its files under its own bank or OTHER, and PDFs only', async () => {
    const parser = new BankOfAmericaParser();
    const claims = (bank: BankName, type = FileType.PDF) =>
      parser.canParse(bank, type, 'x.pdf', STATEMENT);
    await expect(claims(BankName.BANK_OF_AMERICA)).resolves.toBe(true);
    await expect(claims(BankName.OTHER)).resolves.toBe(true);
    await expect(claims(BankName.CHASE)).resolves.toBe(false);
    await expect(claims(BankName.BANK_OF_AMERICA, FileType.CSV)).resolves.toBe(false);
  });

  it('names an ACH entry by its originator, a direct debit when it takes money', () => {
    const purpose = 'ACME POWER DES:DRAFT ID:1000001 INDN:MEMBER ONE CO ID:9000001 WEB';
    expect(bankOfAmericaEntry(row(purpose, { debit: 42.65 }))).toMatchObject({
      counterpartyName: 'ACME POWER',
      paymentType: 'direct_debit',
    });
    expect(bankOfAmericaEntry(row('EXAMPLE PAYROLL DES:SALARY ID:1 PPD', { credit: 10 }))).toMatchObject({
      counterpartyName: 'EXAMPLE PAYROLL',
      paymentType: 'bank_transfer_in',
    });
  });

  it('names a check by its number and a bill payment by its payee', () => {
    expect(bankOfAmericaEntry(row('6623', { debit: 100 }))).toMatchObject({
      counterpartyName: 'Check 6623',
      documentNumber: '6623',
    });
    expect(bankOfAmericaEntry(row('ACME GAS-1053 Bill Payment', { debit: 27 }))).toMatchObject({
      counterpartyName: 'ACME GAS-1053',
      paymentType: 'bank_transfer_out',
    });
  });

  it.each([
    ['Interest Earned', { credit: 0.06 }, 'interest'],
    ['BKOFAMERICA BC 08/12 #000001 WITHDRWL', { debit: 1000 }, 'cash'],
    ['Online Banking payment to CRD 1000 Confirmation# 1', { debit: 10 }, 'bank_transfer_out'],
  ])('types %s', (purpose, amount, paymentType) => {
    expect(bankOfAmericaEntry(row(purpose, amount)).paymentType).toBe(paymentType);
  });
});
