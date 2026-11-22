import { BankName, FileType } from '@/entities/statement.entity';
import type { ParsedTransaction } from '@/modules/parsing/interfaces/parsed-statement.interface';
import {
  WoodforestParser,
  isWoodforestStatement,
  woodforestAccount,
  woodforestEntry,
} from '@/modules/parsing/parsers/woodforest.parser';

const STATEMENT = [
  'P.O. Box 7889 The Woodlands, TX 77387',
  'Visit Us Online at www.woodforest.com',
  'Woodforest Checking 1000000001 7,637.89 1,536.95 4,500.38 10,601.32',
].join('\n');

const row = (paymentPurpose: string, amount: { debit?: number; credit?: number }): ParsedTransaction => ({
  transactionDate: new Date(2020, 1, 11),
  paymentPurpose,
  counterpartyName: paymentPurpose,
  currency: 'USD',
  ...amount,
});

describe('WoodforestParser', () => {
  it('knows its statement by its web address and mailing address', () => {
    expect(isWoodforestStatement(STATEMENT)).toBe(true);
    expect(isWoodforestStatement('Payment to www.woodforest.com')).toBe(false);
  });

  it('parses its files under its own bank or OTHER, and PDFs only', async () => {
    const parser = new WoodforestParser();
    const claims = (bank: BankName, type = FileType.PDF) =>
      parser.canParse(bank, type, 'x.pdf', STATEMENT);
    await expect(claims(BankName.WOODFOREST)).resolves.toBe(true);
    await expect(claims(BankName.OTHER)).resolves.toBe(true);
    await expect(claims(BankName.WEBSTER)).resolves.toBe(false);
    await expect(claims(BankName.WOODFOREST, FileType.CSV)).resolves.toBe(false);
  });

  it('reads the account number after its kind', () => {
    expect(woodforestAccount(STATEMENT)).toBe('1000000001');
  });

  it.each([
    ['POS DB ACME GRILL SAMPLETOWN TX 000000000010000', { debit: 14.45 }, 'ACME GRILL SAMPLETOWN TX', 'card'],
    ['ACH-INS PREM MEMBER ONE ACME MUTUAL', { debit: 337.66 }, 'MEMBER ONE ACME MUTUAL', 'direct_debit'],
    ['DEPOSIT', { credit: 900.38 }, 'DEPOSIT', 'bank_transfer_in'],
  ])('reads %s', (purpose, amount, payee, paymentType) => {
    expect(woodforestEntry(row(purpose, amount))).toMatchObject({ counterpartyName: payee, paymentType });
  });
});
