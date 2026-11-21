import { BankName, FileType } from '@/entities/statement.entity';
import type { ParsedTransaction } from '@/modules/parsing/interfaces/parsed-statement.interface';
import { SantanderParser, isSantanderStatement, santanderEntry } from '@/modules/parsing/parsers/santander.parser';

const STATEMENT = ['Everyday Current Account', 'available at www.santander.co.uk', 'Santander UK plc. Registered Office'].join(
  '\n',
);

const row = (paymentPurpose: string, amount: { debit?: number; credit?: number }): ParsedTransaction => ({
  transactionDate: new Date(2024, 3, 15),
  paymentPurpose,
  counterpartyName: paymentPurpose,
  currency: 'GBP',
  ...amount,
});

describe('SantanderParser', () => {
  it('knows its statement by its web address and legal name', () => {
    expect(isSantanderStatement(STATEMENT)).toBe(true);
    expect(isSantanderStatement('Transfer to santander.co.uk')).toBe(false);
  });

  it('parses its files under its own bank or OTHER, and PDFs only', async () => {
    const parser = new SantanderParser();
    const claims = (bank: BankName, type = FileType.PDF) =>
      parser.canParse(bank, type, 'x.pdf', STATEMENT);
    await expect(claims(BankName.SANTANDER)).resolves.toBe(true);
    await expect(claims(BankName.OTHER)).resolves.toBe(true);
    await expect(claims(BankName.NATWEST)).resolves.toBe(false);
    await expect(claims(BankName.SANTANDER, FileType.CSV)).resolves.toBe(false);
  });

  it.each([
    ['DIRECT DEBIT PAYMENT TO ACME PAYMENT REF 1000AAAA, MANDATE NO 0015', { debit: 32.56 }, 'ACME', 'direct_debit'],
    ['BILL PAYMENT VIA FASTER PAYMENT TO Member One REFERENCE rent MANDATE NO 5', { debit: 20 }, 'Member One', 'bank_transfer_out'],
    ['BANK GIRO CREDIT REF AA11111 1 D ACME AGENCY, 1000', { credit: 375.9 }, '1 D ACME AGENCY, 1000', 'bank_transfer_in'],
  ])('reads %s', (purpose, amount, payee, paymentType) => {
    expect(santanderEntry(row(purpose, amount))).toMatchObject({ counterpartyName: payee, paymentType });
  });
});
