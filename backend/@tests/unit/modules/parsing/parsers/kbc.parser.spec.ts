import { BankName, FileType } from '@/entities/statement.entity';
import type { ParsedTransaction } from '@/modules/parsing/interfaces/parsed-statement.interface';
import { KbcParser, isKbcStatement, kbcEntry } from '@/modules/parsing/parsers/kbc.parser';

const STATEMENT = ['Your Account Details:', 'Account number: 1000000001', 'Wbsite: www.kbc.be'].join('\n');

const row = (paymentPurpose: string, amount: { debit?: number; credit?: number }): ParsedTransaction => ({
  transactionDate: new Date(2025, 0, 9),
  paymentPurpose,
  counterpartyName: paymentPurpose,
  currency: 'EUR',
  ...amount,
});

describe('KbcParser', () => {
  it('knows its statement by its site and the account details box', () => {
    expect(isKbcStatement(STATEMENT)).toBe(true);
    expect(isKbcStatement('Payment to www.kbc.be')).toBe(false);
  });

  it('parses its files under its own bank or OTHER, and PDFs only', async () => {
    const parser = new KbcParser();
    const claims = (bank: BankName, type = FileType.PDF) =>
      parser.canParse(bank, type, 'x.pdf', STATEMENT);
    await expect(claims(BankName.KBC)).resolves.toBe(true);
    await expect(claims(BankName.OTHER)).resolves.toBe(true);
    await expect(claims(BankName.ING)).resolves.toBe(false);
    await expect(claims(BankName.KBC, FileType.CSV)).resolves.toBe(false);
  });

  it.each([
    ['Online Payment to ACME Telecom SD3927', { debit: 69.45 }, 'ACME Telecom SD3927', 'card'],
    ['Received from Member A Ac. 10000001', { credit: 250 }, 'Member A', 'bank_transfer_in'],
    ['ATM Withdrawal from Sampletown @13:54', { debit: 135.67 }, 'ATM Withdrawal from Sampletown @13:54', 'cash'],
  ])('reads %s', (purpose, amount, payee, paymentType) => {
    expect(kbcEntry(row(purpose, amount))).toMatchObject({ counterpartyName: payee, paymentType });
  });
});
