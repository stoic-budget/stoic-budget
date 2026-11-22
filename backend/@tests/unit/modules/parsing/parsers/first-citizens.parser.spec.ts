import { BankName, FileType } from '@/entities/statement.entity';
import type { ParsedTransaction } from '@/modules/parsing/interfaces/parsed-statement.interface';
import {
  FirstCitizensParser,
  firstCitizensEntry,
  isFirstCitizensStatement,
} from '@/modules/parsing/parsers/first-citizens.parser';

const STATEMENT = ['First Citizens Bank', 'Transaction history', 'Date Number Description'].join('\n');

const row = (paymentPurpose: string, amount: { debit?: number; credit?: number }): ParsedTransaction => ({
  transactionDate: new Date(2021, 3, 4),
  paymentPurpose,
  counterpartyName: paymentPurpose,
  currency: 'USD',
  ...amount,
});

describe('FirstCitizensParser', () => {
  it('knows its statement by the bank name and the activity heading', () => {
    expect(isFirstCitizensStatement(STATEMENT)).toBe(true);
    expect(isFirstCitizensStatement('Transfer from First Citizens Bank')).toBe(false);
  });

  it('parses its files under its own bank or OTHER, and PDFs only', async () => {
    const parser = new FirstCitizensParser();
    const claims = (bank: BankName, type = FileType.PDF) =>
      parser.canParse(bank, type, 'x.pdf', STATEMENT);
    await expect(claims(BankName.FIRST_CITIZENS)).resolves.toBe(true);
    await expect(claims(BankName.OTHER)).resolves.toBe(true);
    await expect(claims(BankName.CITIZENS)).resolves.toBe(false);
    await expect(claims(BankName.FIRST_CITIZENS, FileType.CSV)).resolves.toBe(false);
  });

  it('names the shop of a card purchase', () => {
    const purpose = 'Purchase authorized on 12/01 ACME Burger Sampletown GA S380336843369100 Card 1000';
    expect(firstCitizensEntry(row(purpose, { debit: 7.66 }))).toMatchObject({
      counterpartyName: 'ACME Burger Sampletown GA',
      paymentType: 'card',
    });
  });
});
