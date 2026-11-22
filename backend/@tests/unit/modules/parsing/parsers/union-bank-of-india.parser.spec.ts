import { BankName, FileType } from '@/entities/statement.entity';
import type { ParsedTransaction } from '@/modules/parsing/interfaces/parsed-statement.interface';
import {
  UnionBankOfIndiaParser,
  isUnionBankStatement,
  unionBankEntry,
} from '@/modules/parsing/parsers/union-bank-of-india.parser';

const STATEMENT = ['DETAILS OF STATEMENT', 'IFSC : UBIN0100000'].join('\n');

const row = (paymentPurpose: string, amount: { debit?: number; credit?: number }): ParsedTransaction => ({
  transactionDate: new Date(2022, 1, 17),
  paymentPurpose,
  counterpartyName: paymentPurpose,
  currency: 'INR',
  ...amount,
});

describe('UnionBankOfIndiaParser', () => {
  it('knows its statement by its IFSC and title', () => {
    expect(isUnionBankStatement(STATEMENT)).toBe(true);
    expect(isUnionBankStatement('NEFT to UBIN0100000')).toBe(false);
  });

  it('parses its files under its own bank or OTHER, and PDFs only', async () => {
    const parser = new UnionBankOfIndiaParser();
    const claims = (bank: BankName, type = FileType.PDF) =>
      parser.canParse(bank, type, 'x.pdf', STATEMENT);
    await expect(claims(BankName.UNION_BANK_OF_INDIA)).resolves.toBe(true);
    await expect(claims(BankName.OTHER)).resolves.toBe(true);
    await expect(claims(BankName.SBI)).resolves.toBe(false);
    await expect(claims(BankName.UNION_BANK_OF_INDIA, FileType.CSV)).resolves.toBe(false);
  });

  it.each([
    ['UPIAR/100000000001/DR/Member /SAMP/member@ok', { debit: 300 }, 'bank_transfer_out'],
    ['MOBFT to: MEMBER ONE/100000000002', { debit: 8000 }, 'bank_transfer_out'],
    ['MAND DR- ACME1000-', { debit: 2083 }, 'direct_debit'],
    ['General Charges Recovery', { debit: 147.5 }, 'fee'],
  ])('types %s', (purpose, amount, paymentType) => {
    expect(unionBankEntry(row(purpose, amount)).paymentType).toBe(paymentType);
  });
});
