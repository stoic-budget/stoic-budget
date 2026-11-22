import { BankName, FileType } from '@/entities/statement.entity';
import type { ParsedTransaction } from '@/modules/parsing/interfaces/parsed-statement.interface';
import { KeybankParser, isKeybankStatement, keybankEntry } from '@/modules/parsing/parsers/keybank.parser';

const STATEMENT = ['KeyBank Hassle-Free Account', '1-800-KEY2YOU (1-800-539-2968)', 'KeyBank National Association'].join('\n');

const row = (paymentPurpose: string, amount: { debit?: number; credit?: number }): ParsedTransaction => ({
  transactionDate: new Date(2020, 4, 5),
  paymentPurpose,
  counterpartyName: paymentPurpose,
  currency: 'USD',
  ...amount,
});

describe('KeybankParser', () => {
  it('knows its statement by its registered name and phone line', () => {
    expect(isKeybankStatement(STATEMENT)).toBe(true);
    expect(isKeybankStatement('KeyBank National Association transfer')).toBe(false);
  });

  it('parses its files under its own bank or OTHER, and PDFs only', async () => {
    const parser = new KeybankParser();
    const claims = (bank: BankName, type = FileType.PDF) =>
      parser.canParse(bank, type, 'x.pdf', STATEMENT);
    await expect(claims(BankName.KEYBANK)).resolves.toBe(true);
    await expect(claims(BankName.OTHER)).resolves.toBe(true);
    await expect(claims(BankName.HUNTINGTON)).resolves.toBe(false);
    await expect(claims(BankName.KEYBANK, FileType.CSV)).resolves.toBe(false);
  });

  it.each([
    ['POS Mac Acme Fres 3875 Sampletown OH', { debit: 21.31 }, 'Mac Acme Fres 3875 Sampletown OH', 'card'],
    ['ACME Pizzeri Sampletown OH USA', { debit: 34.66 }, 'ACME Pizzeri Sampletown OH USA', 'card'],
    ['ATM Key 6730 Sample Rd Sampletown OH', { debit: 200 }, 'ATM Key 6730 Sample Rd Sampletown OH', 'cash'],
  ])('reads %s', (purpose, amount, payee, paymentType) => {
    expect(keybankEntry(row(purpose, amount))).toMatchObject({ counterpartyName: payee, paymentType });
  });
});
