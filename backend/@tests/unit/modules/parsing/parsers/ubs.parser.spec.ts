import { BankName, FileType } from '@/entities/statement.entity';
import type { ParsedTransaction } from '@/modules/parsing/interfaces/parsed-statement.interface';
import { UbsParser, isUbsStatement, ubsEntry } from '@/modules/parsing/parsers/ubs.parser';

const STATEMENT = ['UBS Bank Statement of Accounts', 'Online: www.ubs.com', 'Write: UBS US AG'].join('\n');

const row = (paymentPurpose: string, amount: { debit?: number; credit?: number }): ParsedTransaction => ({
  transactionDate: new Date(2021, 0, 20),
  paymentPurpose,
  counterpartyName: paymentPurpose,
  currency: 'EUR',
  ...amount,
});

describe('UbsParser', () => {
  it('knows its statement by its web address and entity', () => {
    expect(isUbsStatement(STATEMENT)).toBe(true);
    expect(isUbsStatement('Transfer to www.ubs.com')).toBe(false);
  });

  it('parses its files under its own bank or OTHER, and PDFs only', async () => {
    const parser = new UbsParser();
    const claims = (bank: BankName, type = FileType.PDF) =>
      parser.canParse(bank, type, 'x.pdf', STATEMENT);
    await expect(claims(BankName.UBS)).resolves.toBe(true);
    await expect(claims(BankName.OTHER)).resolves.toBe(true);
    await expect(claims(BankName.HSBC)).resolves.toBe(false);
    await expect(claims(BankName.UBS, FileType.CSV)).resolves.toBe(false);
  });

  it('reads a check by its number and types a card purchase', () => {
    expect(ubsEntry(row('1078 Check', { debit: 250 }))).toMatchObject({ documentNumber: '1078', counterpartyName: 'Check 1078' });
    expect(ubsEntry(row('Purchase authorized', { debit: 895.6 })).paymentType).toBe('card');
  });
});
