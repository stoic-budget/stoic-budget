import { BankName, FileType } from '@/entities/statement.entity';
import type { ParsedTransaction } from '@/modules/parsing/interfaces/parsed-statement.interface';
import { SbiParser, isSbiStatement, sbiEntry, sbiNarration } from '@/modules/parsing/parsers/sbi.parser';

const STATEMENT = ['STATE BANK OF INDIA', 'STATEMENT OF ACCOUNT', 'IFSC : SBIN0001000'].join('\n');

const row = (paymentPurpose: string, amount: { debit?: number; credit?: number }): ParsedTransaction => ({
  transactionDate: new Date(2023, 7, 1),
  paymentPurpose,
  counterpartyName: paymentPurpose,
  currency: 'INR',
  ...amount,
});

describe('SbiParser', () => {
  it('knows its statement by its name and IFSC', () => {
    expect(isSbiStatement(STATEMENT)).toBe(true);
    expect(isSbiStatement('NEFT to STATE BANK OF INDIA')).toBe(false);
  });

  it('parses its files under its own bank or OTHER, and PDFs only', async () => {
    const parser = new SbiParser();
    const claims = (bank: BankName, type = FileType.PDF) =>
      parser.canParse(bank, type, 'x.pdf', STATEMENT);
    await expect(claims(BankName.SBI)).resolves.toBe(true);
    await expect(claims(BankName.OTHER)).resolves.toBe(true);
    await expect(claims(BankName.HDFC)).resolves.toBe(false);
    await expect(claims(BankName.SBI, FileType.CSV)).resolves.toBe(false);
  });

  it('drops the empty reference and money cells from the text', () => {
    expect(sbiNarration('UPI/DR/100000000001/MEMBER 000000 - /SAMP/member.one/UPI')).toBe(
      'UPI/DR/100000000001/MEMBER /SAMP/member.one/UPI',
    );
  });

  it.each([
    ['CASH Withdrawn at GCC 000000 -', { debit: 100 }, 'cash'],
    ['UPI/DR/100000000001/MEMBER 000000 -', { debit: 25 }, 'bank_transfer_out'],
    ['ACHCr SAMP00000000000001 000000 -', { credit: 28 }, 'bank_transfer_in'],
    ['COMM - OTHER MISC. 000000 - SERVICES', { debit: 118 }, 'fee'],
  ])('types %s', (purpose, amount, paymentType) => {
    expect(sbiEntry(row(purpose, amount)).paymentType).toBe(paymentType);
  });
});
