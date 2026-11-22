import { BankName, FileType } from '@/entities/statement.entity';
import type { ParsedTransaction } from '@/modules/parsing/interfaces/parsed-statement.interface';
import { OptumParser, isOptumStatement, optumEntry } from '@/modules/parsing/parsers/optum.parser';

const STATEMENT = ['Optum Bank', 'Participant Account ID: 400000001', 'Online: optumbank.com'].join('\n');

const row = (paymentPurpose: string, amount: { debit?: number; credit?: number }): ParsedTransaction => ({
  transactionDate: new Date(2021, 5, 18),
  paymentPurpose,
  counterpartyName: paymentPurpose,
  currency: 'USD',
  ...amount,
});

describe('OptumParser', () => {
  it('knows its statement by its name and web address', () => {
    expect(isOptumStatement(STATEMENT)).toBe(true);
    expect(isOptumStatement('Payment to Optum Bank')).toBe(false);
  });

  it('parses its files under its own bank or OTHER, and PDFs only', async () => {
    const parser = new OptumParser();
    const claims = (bank: BankName, type = FileType.PDF) =>
      parser.canParse(bank, type, 'x.pdf', STATEMENT);
    await expect(claims(BankName.OPTUM)).resolves.toBe(true);
    await expect(claims(BankName.OTHER)).resolves.toBe(true);
    await expect(claims(BankName.HSA_BANK)).resolves.toBe(false);
    await expect(claims(BankName.OPTUM, FileType.CSV)).resolves.toBe(false);
  });

  it('reads a card payment: its number, then the shop after the time', () => {
    expect(optumEntry(row('578295 POS CHCKING SIG 06/17 02:09 ACME CLINIC SAMPLETOWN FL 96900096 57', { debit: 149.99 }))).toMatchObject({
      documentNumber: '578295',
      counterpartyName: 'ACME CLINIC SAMPLETOWN FL',
      paymentType: 'card',
    });
    expect(optumEntry(row('CURRENT YEAR INDIVIDUAL CONTR', { credit: 19.23 })).paymentType).toBe('bank_transfer_in');
  });
});
