import { BankName, FileType } from '@/entities/statement.entity';
import type { ParsedTransaction } from '@/modules/parsing/interfaces/parsed-statement.interface';
import { GotymeParser, gotymeEntry, isGotymeStatement } from '@/modules/parsing/parsers/gotyme.parser';

const STATEMENT = ['Statement of Account', 'GoTyme Bank Account', 'Visit our website: www.gotyme.com.ph'].join('\n');

const row = (paymentPurpose: string, amount: { debit?: number; credit?: number }): ParsedTransaction => ({
  transactionDate: new Date(2024, 7, 22),
  paymentPurpose,
  counterpartyName: paymentPurpose,
  currency: 'PHP',
  ...amount,
});

describe('GotymeParser', () => {
  it('knows its statement by the account line and the site', () => {
    expect(isGotymeStatement(STATEMENT)).toBe(true);
    expect(isGotymeStatement('Transfer to MEMBER B. GoTyme Bank')).toBe(false);
  });

  it('parses its files under its own bank or OTHER, and PDFs only', async () => {
    const parser = new GotymeParser();
    const claims = (bank: BankName, type = FileType.PDF) =>
      parser.canParse(bank, type, 'x.pdf', STATEMENT);
    await expect(claims(BankName.GOTYME)).resolves.toBe(true);
    await expect(claims(BankName.OTHER)).resolves.toBe(true);
    await expect(claims(BankName.BPI)).resolves.toBe(false);
    await expect(claims(BankName.GOTYME, FileType.CSV)).resolves.toBe(false);
  });

  it.each([
    ['Card payment at ACME STORE, Card •••• 1000', { debit: 57.09 }, 'ACME STORE', 'card'],
    ['In-app purchase for Mobile from ACME TEL, for +63••••••1000', { debit: 10 }, 'ACME TEL', 'card'],
    ['Transfer from MEMBER C. GoTyme Bank, Account No. •••• •••• 1000', { credit: 48 }, 'MEMBER C.', 'bank_transfer_in'],
    ['Outbound interbank transfer', { debit: 500 }, 'Outbound interbank transfer', 'bank_transfer_out'],
  ])('reads %s', (purpose, amount, payee, paymentType) => {
    expect(gotymeEntry(row(purpose, amount))).toMatchObject({ counterpartyName: payee, paymentType });
  });
});
