import { BankName, FileType } from '@/entities/statement.entity';
import type { ParsedTransaction } from '@/modules/parsing/interfaces/parsed-statement.interface';
import {
  DiscoverParser,
  discoverEntry,
  isDiscoverStatement,
} from '@/modules/parsing/parsers/discover.parser';

const STATEMENT = [
  'Discover it® chrome Card',
  'Account number ending in 1000',
  'Cardmember Since 2017',
  'The Discover® card is issued by Discover Bank, Member FDIC.',
].join('\n');

const row = (paymentPurpose: string, amount: { debit?: number; credit?: number }): ParsedTransaction => ({
  transactionDate: new Date(2017, 9, 2),
  paymentPurpose,
  counterpartyName: paymentPurpose,
  currency: 'USD',
  ...amount,
});

describe('DiscoverParser', () => {
  it('knows its statement by the issuer and the card', () => {
    expect(isDiscoverStatement(STATEMENT)).toBe(true);
    expect(isDiscoverStatement('DISCOVER E-PAYMENT 1234')).toBe(false);
  });

  it('parses its files under its own bank or OTHER, and PDFs only', async () => {
    const parser = new DiscoverParser();
    const claims = (bank: BankName, type = FileType.PDF) =>
      parser.canParse(bank, type, 'x.pdf', STATEMENT);
    await expect(claims(BankName.DISCOVER)).resolves.toBe(true);
    await expect(claims(BankName.OTHER)).resolves.toBe(true);
    await expect(claims(BankName.CAPITAL_ONE)).resolves.toBe(false);
    await expect(claims(BankName.DISCOVER, FileType.CSV)).resolves.toBe(false);
  });

  it('types a payment as money in and a charge as a card payment', () => {
    expect(discoverEntry(row('INTERNET PAYMENT - THANK YOU', { credit: 180 })).paymentType).toBe(
      'bank_transfer_in',
    );
    expect(discoverEntry(row('ACME STORE SAMPLETOWN KY', { debit: 22.37 })).paymentType).toBe('card');
  });
});
