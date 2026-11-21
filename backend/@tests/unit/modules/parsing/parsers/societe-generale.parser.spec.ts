import { BankName, FileType } from '@/entities/statement.entity';
import type { ParsedTransaction } from '@/modules/parsing/interfaces/parsed-statement.interface';
import {
  SocieteGeneraleParser,
  isSocieteGeneraleStatement,
  societeGeneraleEntry,
} from '@/modules/parsing/parsers/societe-generale.parser';

const STATEMENT = ['Relevé de compte', 'n° 30003 01000 00010000000 12', 'Internet : particuliers.societegenerale.fr'].join('\n');

const row = (paymentPurpose: string, amount: { debit?: number; credit?: number }): ParsedTransaction => ({
  transactionDate: new Date(2010, 5, 10),
  paymentPurpose,
  counterpartyName: paymentPurpose,
  currency: 'EUR',
  ...amount,
});

describe('SocieteGeneraleParser', () => {
  it('knows its statement by its site and title', () => {
    expect(isSocieteGeneraleStatement(STATEMENT)).toBe(true);
    expect(isSocieteGeneraleStatement('Relevé de compte')).toBe(false);
  });

  it('parses its files under its own bank or OTHER, and PDFs only', async () => {
    const parser = new SocieteGeneraleParser();
    const claims = (bank: BankName, type = FileType.PDF) =>
      parser.canParse(bank, type, 'x.pdf', STATEMENT);
    await expect(claims(BankName.SOCIETE_GENERALE)).resolves.toBe(true);
    await expect(claims(BankName.OTHER)).resolves.toBe(true);
    await expect(claims(BankName.CREDIT_AGRICOLE)).resolves.toBe(false);
    await expect(claims(BankName.SOCIETE_GENERALE, FileType.CSV)).resolves.toBe(false);
  });

  it.each([
    ['CARTE X1000 09/06 ACME MARKET', { debit: 60 }, 'ACME MARKET', 'card'],
    ['VIR RECU 1000000001 DE: ACME EAUX MOTIF: 1000', { credit: 109.43 }, 'ACME EAUX', 'bank_transfer_in'],
    ['CARTE X1000 RETRAIT DAB SG 10/06 06H27', { debit: 50 }, 'CARTE X1000 RETRAIT DAB SG 10/06 06H27', 'cash'],
  ])('reads %s', (purpose, amount, payee, paymentType) => {
    expect(societeGeneraleEntry(row(purpose, amount))).toMatchObject({ counterpartyName: payee, paymentType });
  });
});
