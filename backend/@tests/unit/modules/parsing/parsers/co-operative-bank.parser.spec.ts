import { BankName, FileType } from '@/entities/statement.entity';
import type { ParsedTransaction } from '@/modules/parsing/interfaces/parsed-statement.interface';
import {
  CoOperativeBankParser,
  coOperativeEntry,
  isCoOperativeStatement,
} from '@/modules/parsing/parsers/co-operative-bank.parser';

const STATEMENT = ['The Co-operative Bank', 'cashminder statement', 'IBAN : GB00 CPBK 0000 0000 1000 01 BIC : CPBK GB 22'].join('\n');

const row = (paymentPurpose: string, amount: { debit?: number; credit?: number }): ParsedTransaction => ({
  transactionDate: new Date(2015, 10, 30),
  paymentPurpose,
  counterpartyName: paymentPurpose,
  currency: 'GBP',
  ...amount,
});

describe('CoOperativeBankParser', () => {
  it('knows its statement by its name and BIC', () => {
    expect(isCoOperativeStatement(STATEMENT)).toBe(true);
    expect(isCoOperativeStatement('Transfer to The Co-operative Bank')).toBe(false);
  });

  it('parses its files under its own bank or OTHER, and PDFs only', async () => {
    const parser = new CoOperativeBankParser();
    const claims = (bank: BankName, type = FileType.PDF) =>
      parser.canParse(bank, type, 'x.pdf', STATEMENT);
    await expect(claims(BankName.CO_OPERATIVE_BANK)).resolves.toBe(true);
    await expect(claims(BankName.OTHER)).resolves.toBe(true);
    await expect(claims(BankName.NATWEST)).resolves.toBe(false);
    await expect(claims(BankName.CO_OPERATIVE_BANK, FileType.CSV)).resolves.toBe(false);
  });

  it.each([
    ['COOP ATM12:35NOV30', { debit: 70 }, 'cash'],
    ['820000000001-CHB', { credit: 34.4 }, 'bank_transfer_in'],
  ])('types %s', (purpose, amount, paymentType) => {
    expect(coOperativeEntry(row(purpose, amount)).paymentType).toBe(paymentType);
  });
});
