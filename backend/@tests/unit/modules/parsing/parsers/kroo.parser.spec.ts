import { BankName, FileType } from '@/entities/statement.entity';
import type { ParsedTransaction } from '@/modules/parsing/interfaces/parsed-statement.interface';
import { KrooParser, isKrooStatement, krooEntry } from '@/modules/parsing/parsers/kroo.parser';

const STATEMENT = ['Your statement', 'Kroo Current Account', 'Kroo Bank Ltd is authorised as a bank'].join('\n');

const row = (paymentPurpose: string, amount: { debit?: number; credit?: number }): ParsedTransaction => ({
  transactionDate: new Date(2024, 3, 5),
  paymentPurpose,
  counterpartyName: paymentPurpose,
  currency: 'GBP',
  ...amount,
});

describe('KrooParser', () => {
  it('knows its statement by the bank and the account name', () => {
    expect(isKrooStatement(STATEMENT)).toBe(true);
    expect(isKrooStatement('Transfer to Kroo Bank Ltd')).toBe(false);
  });

  it('parses its files under its own bank or OTHER, and PDFs only', async () => {
    const parser = new KrooParser();
    const claims = (bank: BankName, type = FileType.PDF) =>
      parser.canParse(bank, type, 'x.pdf', STATEMENT);
    await expect(claims(BankName.KROO)).resolves.toBe(true);
    await expect(claims(BankName.OTHER)).resolves.toBe(true);
    await expect(claims(BankName.HSBC)).resolves.toBe(false);
    await expect(claims(BankName.KROO, FileType.CSV)).resolves.toBe(false);
  });

  it('reads a transfer in by its sender', () => {
    expect(krooEntry(row('Faster Payment from Member Two', { credit: 4200 }))).toMatchObject({
      counterpartyName: 'Member Two',
      paymentType: 'bank_transfer_in',
    });
  });
});
