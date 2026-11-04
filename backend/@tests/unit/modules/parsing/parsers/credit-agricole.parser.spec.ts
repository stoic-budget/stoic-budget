import { BankName, FileType } from '@/entities/statement.entity';
import type { ParsedTransaction } from '@/modules/parsing/interfaces/parsed-statement.interface';
import {
  CreditAgricoleParser,
  creditAgricoleEntry,
  isCreditAgricoleStatement,
} from '@/modules/parsing/parsers/credit-agricole.parser';

const STATEMENT = [
  'CREDIT AGRICOLE RELEVE DE COMPTES EN EUROS N° 001',
  "BRIE PICARDIE Date d'arrêté : 17 Janvier 2022",
].join('\n');

const row = (paymentPurpose: string, amount: { debit?: number; credit?: number }): ParsedTransaction => ({
  transactionDate: new Date(2021, 11, 20),
  paymentPurpose,
  counterpartyName: paymentPurpose,
  currency: 'EUR',
  ...amount,
});

describe('CreditAgricoleParser', () => {
  it('knows its statement by the bank name and the statement title', () => {
    expect(isCreditAgricoleStatement(STATEMENT)).toBe(true);
    expect(isCreditAgricoleStatement('Virement Crédit Agricole')).toBe(false);
    expect(isCreditAgricoleStatement('RELEVE DE COMPTES')).toBe(false);
  });

  it('parses its files under its own bank or OTHER, and PDFs only', async () => {
    const parser = new CreditAgricoleParser();
    const claims = (bank: BankName, type = FileType.PDF) =>
      parser.canParse(bank, type, 'x.pdf', STATEMENT);
    await expect(claims(BankName.CREDIT_AGRICOLE)).resolves.toBe(true);
    await expect(claims(BankName.OTHER)).resolves.toBe(true);
    await expect(claims(BankName.COMMERCIAL_BANK)).resolves.toBe(false);
    await expect(claims(BankName.CREDIT_AGRICOLE, FileType.CSV)).resolves.toBe(false);
  });

  it('drops the tick boxes and names a card payment by its merchant', () => {
    expect(creditAgricoleEntry(row('¨ Carte ACME Store Paris 19/12 ¨', { debit: 12.99 }))).toMatchObject({
      paymentPurpose: 'Carte ACME Store Paris 19/12',
      counterpartyName: 'ACME Store Paris',
      paymentType: 'card',
    });
    expect(creditAgricoleEntry(row('Avoir Carte ACME Market 15/12', { credit: 7.44 }))).toMatchObject({
      counterpartyName: 'ACME Market',
      paymentType: 'card',
    });
  });

  it('reads the fee mark as a fee and leaves it out of the text', () => {
    expect(creditAgricoleEntry(row('¨ ** Cotis Exemple', { debit: 2 }))).toMatchObject({
      paymentPurpose: 'Cotis Exemple',
      paymentType: 'fee',
    });
  });

  it.each([
    ['Retrait Dab Paris', { debit: 40 }, 'cash'],
    ['Prlv ACME Energie', { debit: 50 }, 'direct_debit'],
    ['Virement Membre Un', { credit: 100 }, 'bank_transfer_in'],
    ['Vir Membre Un', { debit: 100 }, 'bank_transfer_out'],
  ])('types %s', (purpose, amount, paymentType) => {
    expect(creditAgricoleEntry(row(purpose, amount)).paymentType).toBe(paymentType);
  });

  it('leaves an entry its words do not name untyped', () => {
    expect(creditAgricoleEntry(row('Remise Cheque', { credit: 30 })).paymentType).toBeUndefined();
  });
});
