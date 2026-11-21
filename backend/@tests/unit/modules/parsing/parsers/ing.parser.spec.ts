import { BankName, FileType } from '@/entities/statement.entity';
import type { ParsedTransaction } from '@/modules/parsing/interfaces/parsed-statement.interface';
import { IngParser, ingEntry, isIngStatement } from '@/modules/parsing/parsers/ing.parser';

const STATEMENT = ['Orange Everyday', 'statement', 'ING Bank (Australia) Limited ABN 24 000 893 292'].join('\n');

const row = (paymentPurpose: string, amount: { debit?: number; credit?: number }): ParsedTransaction => ({
  transactionDate: new Date(2023, 2, 2),
  paymentPurpose,
  counterpartyName: paymentPurpose,
  currency: 'AUD',
  ...amount,
});

describe('IngParser', () => {
  it('knows its statement by the bank and the account name', () => {
    expect(isIngStatement(STATEMENT)).toBe(true);
    expect(isIngStatement('Transfer to ING Bank (Australia)')).toBe(false);
  });

  it('parses its files under its own bank or OTHER, and PDFs only', async () => {
    const parser = new IngParser();
    const claims = (bank: BankName, type = FileType.PDF) =>
      parser.canParse(bank, type, 'x.pdf', STATEMENT);
    await expect(claims(BankName.ING)).resolves.toBe(true);
    await expect(claims(BankName.OTHER)).resolves.toBe(true);
    await expect(claims(BankName.ANZ)).resolves.toBe(false);
    await expect(claims(BankName.ING, FileType.CSV)).resolves.toBe(false);
  });

  it.each([
    ['Visa Purchase - Receipt 130125 ACME CAFE SAMPLETOWN Date 30/02/23 Card 1000', { debit: 19.9 }, 'ACME CAFE SAMPLETOWN', 'card'],
    ['BPAY Bill Payment - Receipt 252554 Acme Water 15507598947 Waterbill', { debit: 66.29 }, 'Acme Water', 'bank_transfer_out'],
    ['Wave and Save Rebate - Receipt 130124', { credit: 0.07 }, 'Wave and Save Rebate - Receipt 130124', 'interest'],
  ])('reads %s', (purpose, amount, payee, paymentType) => {
    expect(ingEntry(row(purpose, amount))).toMatchObject({ counterpartyName: payee, paymentType });
  });
});
