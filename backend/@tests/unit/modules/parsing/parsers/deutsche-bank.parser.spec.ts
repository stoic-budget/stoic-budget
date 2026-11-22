import { BankName, FileType } from '@/entities/statement.entity';
import type { ParsedTransaction } from '@/modules/parsing/interfaces/parsed-statement.interface';
import {
  DeutscheBankParser,
  deutscheBankEntry,
  isDeutscheBankStatement,
} from '@/modules/parsing/parsers/deutsche-bank.parser';

const STATEMENT = [
  'Deutsche Bank Privat- und Geschäftskunden AG',
  'Statement Page IBAN BIC (SWIFT) Previous balance as at 29.03.2018',
  '5 1/7 DE00 1000 2000 3000 4000 00 DEUTDEDB101 EUR +100.00',
].join('\n');

const row = (paymentPurpose: string, amount: { debit?: number; credit?: number }): ParsedTransaction => ({
  transactionDate: new Date(2022, 4, 3),
  paymentPurpose,
  counterpartyName: paymentPurpose,
  currency: 'EUR',
  ...amount,
});

describe('DeutscheBankParser', () => {
  it('knows its statement by the bank name and its BIC', () => {
    expect(isDeutscheBankStatement(STATEMENT)).toBe(true);
    expect(isDeutscheBankStatement('Transfer to Deutsche Bank customer')).toBe(false);
  });

  it('parses its files under its own bank or OTHER, and PDFs only', async () => {
    const parser = new DeutscheBankParser();
    const claims = (bank: BankName, type = FileType.PDF) =>
      parser.canParse(bank, type, 'x.pdf', STATEMENT);
    await expect(claims(BankName.DEUTSCHE_BANK)).resolves.toBe(true);
    await expect(claims(BankName.OTHER)).resolves.toBe(true);
    await expect(claims(BankName.BNP_PARIBAS)).resolves.toBe(false);
    await expect(claims(BankName.DEUTSCHE_BANK, FileType.CSV)).resolves.toBe(false);
  });

  it.each([
    [
      'Kartenzahlung Payment Reference/E2E-Ref. ACME MARKT 1, BERLIN//BERLIN/DE 29-05-2022',
      { debit: 2.74 },
      'ACME MARKT 1, BERLIN',
      'card',
    ],
    [
      'SEPA Lastschrifteinzug von ACME Fitness GmbH Payment Reference/E2E-Ref. XREF 1',
      { debit: 20 },
      'ACME Fitness GmbH',
      'direct_debit',
    ],
    [
      'SEPA Überweisung von Example Employer Payment Reference/E2E-Ref. Lohn und Gehalt',
      { credit: 3500.5 },
      'Example Employer',
      'bank_transfer_in',
    ],
    [
      'Payment Reference/E2E-Ref. GA NR08484020 BLZ100708480930.03/21.19UHR B-SAMPLE',
      { debit: 10 },
      'Auszahlung Geldautomat',
      'cash',
    ],
  ])('reads %s', (purpose, amount, payee, paymentType) => {
    expect(deutscheBankEntry(row(purpose, amount))).toMatchObject({ counterpartyName: payee, paymentType });
  });
});
