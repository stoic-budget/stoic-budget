import { BankName, FileType } from '@/entities/statement.entity';
import type { ParsedTransaction } from '@/modules/parsing/interfaces/parsed-statement.interface';
import { RbcParser, isRbcStatement, rbcEntry } from '@/modules/parsing/parsers/rbc.parser';

const STATEMENT = ['Royal Bank of Canada', 'Your RBC personal banking', 'account statement'].join('\n');

const row = (paymentPurpose: string, amount: { debit?: number; credit?: number }): ParsedTransaction => ({
  transactionDate: new Date(2018, 11, 24),
  paymentPurpose,
  counterpartyName: paymentPurpose,
  currency: 'CAD',
  ...amount,
});

describe('RbcParser', () => {
  it('knows its statement by its name and title', () => {
    expect(isRbcStatement(STATEMENT)).toBe(true);
    expect(isRbcStatement('Transfer from Royal Bank of Canada')).toBe(false);
  });

  it('parses its files under its own bank or OTHER, and PDFs only', async () => {
    const parser = new RbcParser();
    const claims = (bank: BankName, type = FileType.PDF) =>
      parser.canParse(bank, type, 'x.pdf', STATEMENT);
    await expect(claims(BankName.RBC)).resolves.toBe(true);
    await expect(claims(BankName.OTHER)).resolves.toBe(true);
    await expect(claims(BankName.CIBC)).resolves.toBe(false);
    await expect(claims(BankName.RBC, FileType.CSV)).resolves.toBe(false);
  });

  it.each([
    ['Contactless Interac purchase - 1000 ACME STORE', { debit: 12.34 }, 'ACME STORE', 'card'],
    ['e-Transfer sent member', { debit: 200 }, 'member', 'bank_transfer_out'],
    ['e-Transfer - Autodeposit', { credit: 40 }, 'e-Transfer - Autodeposit', 'bank_transfer_in'],
    ['Online Banking payment - 1825 ACME MASTERCD', { debit: 300 }, 'ACME MASTERCD', 'direct_debit'],
  ])('reads %s', (purpose, amount, payee, paymentType) => {
    expect(rbcEntry(row(purpose, amount))).toMatchObject({ counterpartyName: payee, paymentType });
  });
});
