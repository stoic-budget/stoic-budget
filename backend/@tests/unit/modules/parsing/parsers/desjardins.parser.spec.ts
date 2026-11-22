import { BankName, FileType } from '@/entities/statement.entity';
import type { ParsedTransaction } from '@/modules/parsing/interfaces/parsed-statement.interface';
import {
  DesjardinsParser,
  desjardinsEntry,
  isDesjardinsStatement,
} from '@/modules/parsing/parsers/desjardins.parser';

const STATEMENT = ['CAISSE DESJARDINS DE SAMPLETOWN', 'Folio', '10001 Page 1 of 2', 'STATEMENT OF ACCOUNT'].join('\n');

const row = (paymentPurpose: string, amount: { debit?: number; credit?: number }): ParsedTransaction => ({
  transactionDate: new Date(2024, 4, 9),
  paymentPurpose,
  counterpartyName: paymentPurpose,
  currency: 'CAD',
  ...amount,
});

describe('DesjardinsParser', () => {
  it('knows its statement by the caisse and the title, in English or French', () => {
    expect(isDesjardinsStatement(STATEMENT)).toBe(true);
    expect(isDesjardinsStatement('CAISSE DESJARDINS DE SAMPLETOWN\nRELEVÉ DE COMPTE')).toBe(true);
    expect(isDesjardinsStatement('Visa Desjardins')).toBe(false);
  });

  it('parses its files under its own bank or OTHER, and PDFs only', async () => {
    const parser = new DesjardinsParser();
    const claims = (bank: BankName, type = FileType.PDF) =>
      parser.canParse(bank, type, 'x.pdf', STATEMENT);
    await expect(claims(BankName.DESJARDINS)).resolves.toBe(true);
    await expect(claims(BankName.OTHER)).resolves.toBe(true);
    await expect(claims(BankName.CIBC)).resolves.toBe(false);
    await expect(claims(BankName.DESJARDINS, FileType.CSV)).resolves.toBe(false);
  });

  it.each([
    ['Purchase / ACME COFFEE #1031', { debit: 6.26 }, 'ACME COFFEE #1031', 'card'],
    ['Pre-authorized purchase / ACME FUEL', { debit: 60 }, 'ACME FUEL', 'direct_debit'],
    ['Withdrawal on ATM / CDS SAMPLETOWN', { debit: 100 }, 'CDS SAMPLETOWN', 'cash'],
    ['Interac e-Transfer to / member two /', { debit: 500 }, 'member two', 'bank_transfer_out'],
    ['Interac e-Transfer from / SAMPLE PAYER/', { credit: 225 }, 'SAMPLE PAYER', 'bank_transfer_in'],
    ['Payroll Deposit ACME INC', { credit: 6995.09 }, 'Payroll Deposit ACME INC', 'bank_transfer_in'],
  ])('reads %s', (purpose, amount, payee, paymentType) => {
    expect(desjardinsEntry(row(purpose, amount))).toMatchObject({ counterpartyName: payee, paymentType });
  });
});
