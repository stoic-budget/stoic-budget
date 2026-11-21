import { BankName, FileType } from '@/entities/statement.entity';
import type { ParsedTransaction } from '@/modules/parsing/interfaces/parsed-statement.interface';
import {
  RaiffeisenParser,
  isRaiffeisenStatement,
  raiffeisenBalances,
  raiffeisenEntry,
  restoreLetters,
} from '@/modules/parsing/parsers/raiffeisen.parser';

const STATEMENT = ['Extras de cont', 'Cod BIC Raiffeisen Bank: RZBRROBU', 'Unitate bancar`: RAIFFEISEN BANK S.A.'].join('\n');

const row = (paymentPurpose: string, amount: { debit?: number; credit?: number }): ParsedTransaction => ({
  transactionDate: new Date(2020, 6, 13),
  paymentPurpose,
  counterpartyName: paymentPurpose,
  currency: 'RON',
  ...amount,
});

describe('RaiffeisenParser', () => {
  it('knows its statement by its BIC and name', () => {
    expect(isRaiffeisenStatement(STATEMENT)).toBe(true);
    expect(isRaiffeisenStatement('Plata RAIFFEISEN BANK S.A.')).toBe(false);
  });

  it('parses its files under its own bank or OTHER, and PDFs only', async () => {
    const parser = new RaiffeisenParser();
    const claims = (bank: BankName, type = FileType.PDF) =>
      parser.canParse(bank, type, 'x.pdf', STATEMENT);
    await expect(claims(BankName.RAIFFEISEN)).resolves.toBe(true);
    await expect(claims(BankName.OTHER)).resolves.toBe(true);
    await expect(claims(BankName.ING)).resolves.toBe(false);
    await expect(claims(BankName.RAIFFEISEN, FileType.CSV)).resolves.toBe(false);
  });

  it('restores the letters the font prints as punctuation, inside words only', () => {
    expect(restoreLetters('Dat`')).toBe('Dată');
    expect(restoreLetters('tranzac]iei')).toBe('tranzacției');
    expect(restoreLetters('[1]')).toBe('[1]');
  });

  it('takes the balances from the summary', () => {
    const text = 'Sold ini]ial Rulaj debitor Rulaj creditor Sold final\n19,996.08 2,188.85 4,356.00 22,163.23';
    expect(raiffeisenBalances(text)).toEqual({ start: 19996.08, end: 22163.23 });
  });

  it.each([
    ['ACME 248 SAMPLETOWN Card nr. XXXX XXXX XXXX 1000', { debit: 169.99 }, 'ACME 248 SAMPLETOWN', 'card'],
    ['OPIB/1 MEMBER ONE RO00 SAMP 0000 0600 1000 0002 SAMPLE BANK', { debit: 100 }, 'MEMBER ONE', 'bank_transfer_out'],
    ['ATM SAMPLETOWN Card nr. XXXX XXXX XXXX 1000', { debit: 300 }, 'ATM SAMPLETOWN Card nr. XXXX XXXX XXXX 1000', 'cash'],
  ])('reads %s', (purpose, amount, payee, paymentType) => {
    expect(raiffeisenEntry(row(purpose, amount))).toMatchObject({ counterpartyName: payee, paymentType });
  });
});
