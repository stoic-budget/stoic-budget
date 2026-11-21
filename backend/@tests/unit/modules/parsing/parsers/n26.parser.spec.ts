import { BankName, FileType } from '@/entities/statement.entity';
import type { ParsedTransaction } from '@/modules/parsing/interfaces/parsed-statement.interface';
import { N26Parser, isN26Statement, n26Account, n26Entry } from '@/modules/parsing/parsers/n26.parser';

const HOLDER = 'IT00X0000010000000000000001';
const PARTY = 'DE00100000000000000001';
const FOOTER = `Member One  Issued on\nIBAN: ${HOLDER} • BIC: SAMPIT22  Nr. 01/2023`;
const STATEMENT = ['Bank Statement Nr. 01/2023', `Member Two  +400,00€\nIncome\nIBAN: ${PARTY} • BIC: SAMPDEFF`, FOOTER, FOOTER, 'Your N26 Team'].join('\n');

const row = (paymentPurpose: string, amount: { debit?: number; credit?: number }): ParsedTransaction => ({
  transactionDate: new Date(2023, 0, 19),
  paymentPurpose,
  counterpartyName: paymentPurpose,
  currency: 'EUR',
  ...amount,
});

describe('N26Parser', () => {
  it('knows its statement by its sign-off and title', () => {
    expect(isN26Statement(STATEMENT)).toBe(true);
    expect(isN26Statement('Bank Statement Nr. 01/2023')).toBe(false);
  });

  it('parses its files under its own bank or OTHER, and PDFs only', async () => {
    const parser = new N26Parser();
    const claims = (bank: BankName, type = FileType.PDF) =>
      parser.canParse(bank, type, 'x.pdf', STATEMENT);
    await expect(claims(BankName.N26)).resolves.toBe(true);
    await expect(claims(BankName.OTHER)).resolves.toBe(true);
    await expect(claims(BankName.ING)).resolves.toBe(false);
    await expect(claims(BankName.N26, FileType.CSV)).resolves.toBe(false);
  });

  it('takes the IBAN printed at the foot of every page, letter-spaced or not', () => {
    expect(n26Account(STATEMENT)).toBe(HOLDER);
    expect(n26Account(`${STATEMENT}\nIT00X00 00010000000000000001 • B IC`)).toBe(HOLDER);
  });

  it.each([
    ['ACME Hosting Mastercard • Business Expenses', { debit: 11.64 }, 'ACME Hosting', 'card'],
    ['Member Two Income IBAN: DE00 • BIC: SAMPDEFF', { credit: 400 }, 'Member Two', 'bank_transfer_in'],
    ['Member Three MoneyBeam for food', { debit: 300 }, 'Member Three', 'bank_transfer_out'],
  ])('reads %s', (purpose, amount, payee, paymentType) => {
    expect(n26Entry(row(purpose, amount))).toMatchObject({ counterpartyName: payee, paymentType });
  });
});
