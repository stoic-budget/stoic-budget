import { BankName, FileType } from '@/entities/statement.entity';
import type { ParsedTransaction } from '@/modules/parsing/interfaces/parsed-statement.interface';
import { StarlingParser, isStarlingStatement, starlingEntry } from '@/modules/parsing/parsers/starling.parser';

const STATEMENT = ['24hr Customer Service www.starlingbank.com', 'BIC: SRLGGB2L', 'DATE TYPE TRANSACTION IN OUT'].join('\n');

const row = (paymentPurpose: string, amount: { debit?: number; credit?: number }): ParsedTransaction => ({
  transactionDate: new Date(2023, 10, 1),
  paymentPurpose,
  counterpartyName: paymentPurpose,
  currency: 'GBP',
  ...amount,
});

describe('StarlingParser', () => {
  it('knows its statement by its web address and BIC', () => {
    expect(isStarlingStatement(STATEMENT)).toBe(true);
    expect(isStarlingStatement('Transfer to www.starlingbank.com')).toBe(false);
  });

  it('parses its files under its own bank or OTHER, and PDFs only', async () => {
    const parser = new StarlingParser();
    const claims = (bank: BankName, type = FileType.PDF) =>
      parser.canParse(bank, type, 'x.pdf', STATEMENT);
    await expect(claims(BankName.STARLING)).resolves.toBe(true);
    await expect(claims(BankName.OTHER)).resolves.toBe(true);
    await expect(claims(BankName.MONZO)).resolves.toBe(false);
    await expect(claims(BankName.STARLING, FileType.CSV)).resolves.toBe(false);
  });

  it.each([
    ['FASTER PAYMENT Member One (rent)', { credit: 20 }, 'Member One', 'bank_transfer_in'],
    ['ONLINE PAYMENT ACME', { debit: 14 }, 'ACME', 'card'],
    ['DEPOSIT INTEREST Sample Bank (November Interest Earned)', { credit: 0.01 }, 'Sample Bank', 'interest'],
  ])('reads %s', (purpose, amount, payee, paymentType) => {
    expect(starlingEntry(row(purpose, amount))).toMatchObject({ counterpartyName: payee, paymentType });
  });
});
