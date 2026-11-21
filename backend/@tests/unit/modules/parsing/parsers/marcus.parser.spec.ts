import { BankName, FileType } from '@/entities/statement.entity';
import type { ParsedTransaction } from '@/modules/parsing/interfaces/parsed-statement.interface';
import { MarcusParser, isMarcusStatement, marcusEntry } from '@/modules/parsing/parsers/marcus.parser';

const STATEMENT = ['Goldman Sachs Bank USA', 'Marcus.com', 'ONLINE SAVINGS ACCOUNT STATEMENT'].join('\n');

const row = (paymentPurpose: string, amount: { debit?: number; credit?: number }): ParsedTransaction => ({
  transactionDate: new Date(2025, 1, 8),
  paymentPurpose,
  counterpartyName: paymentPurpose,
  currency: 'USD',
  ...amount,
});

describe('MarcusParser', () => {
  it('knows its statement by the bank and its web address', () => {
    expect(isMarcusStatement(STATEMENT)).toBe(true);
    expect(isMarcusStatement('Goldman Sachs Bank USA')).toBe(false);
  });

  it('parses its files under its own bank or OTHER, and PDFs only', async () => {
    const parser = new MarcusParser();
    const claims = (bank: BankName, type = FileType.PDF) =>
      parser.canParse(bank, type, 'x.pdf', STATEMENT);
    await expect(claims(BankName.MARCUS)).resolves.toBe(true);
    await expect(claims(BankName.OTHER)).resolves.toBe(true);
    await expect(claims(BankName.CHASE)).resolves.toBe(false);
    await expect(claims(BankName.MARCUS, FileType.CSV)).resolves.toBe(false);
  });

  it.each([
    ['ACH Deposit Internet transfer from ACME BANK, NA SAV account **** 1000', { credit: 50 }, 'ACME BANK, NA', 'bank_transfer_in'],
    ['ACH Withdrawal Internet transfer to ACME BANK, NA SAV account **** 1000', { debit: 150 }, 'ACME BANK, NA', 'bank_transfer_out'],
    ['Interest Paid', { credit: 39.16 }, 'Interest Paid', 'interest'],
  ])('reads %s', (purpose, amount, payee, paymentType) => {
    expect(marcusEntry(row(purpose, amount))).toMatchObject({ counterpartyName: payee, paymentType });
  });
});
