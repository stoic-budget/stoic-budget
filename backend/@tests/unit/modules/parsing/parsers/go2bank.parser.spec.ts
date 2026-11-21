import { BankName, FileType } from '@/entities/statement.entity';
import type { ParsedTransaction } from '@/modules/parsing/interfaces/parsed-statement.interface';
import { Go2bankParser, go2bankEntry, isGo2bankStatement } from '@/modules/parsing/parsers/go2bank.parser';

const STATEMENT = ['ACCOUNT SUMMARY', 'Customer Care, P.O. Box 5100,', 'Pasadena, CA 91117', 'AVAILABLE BALANCE'].join(
  '\n',
);

const row = (party: string, kind: string, amount: { debit?: number; credit?: number }): ParsedTransaction => ({
  transactionDate: new Date(2021, 0, 12),
  paymentPurpose: `${party} ${kind}`,
  counterpartyName: party,
  currency: 'USD',
  ...amount,
});

describe('Go2bankParser', () => {
  it('knows its statement by the care address and the balance heading', () => {
    expect(isGo2bankStatement(STATEMENT)).toBe(true);
    expect(isGo2bankStatement('AVAILABLE BALANCE')).toBe(false);
  });

  it('parses its files under its own bank or OTHER, and PDFs only', async () => {
    const parser = new Go2bankParser();
    const claims = (bank: BankName, type = FileType.PDF) =>
      parser.canParse(bank, type, 'x.pdf', STATEMENT);
    await expect(claims(BankName.GO2BANK)).resolves.toBe(true);
    await expect(claims(BankName.OTHER)).resolves.toBe(true);
    await expect(claims(BankName.CHIME)).resolves.toBe(false);
    await expect(claims(BankName.GO2BANK, FileType.CSV)).resolves.toBe(false);
  });

  it.each([
    ['EXAMPLE PAYER', 'Deposit', { credit: 182 }, 'bank_transfer_in'],
    ['ACME ATM 8TH AVENUE', 'ATM Withdrawal SAMPLETOWN NY', { debit: 201.79 }, 'cash'],
    ['Out of Network ATM Withdrawal Fee', 'Fee', { debit: 3 }, 'fee'],
    ['ACME STORE', 'Purchase SAMPLETOWN NY', { debit: 12.5 }, 'card'],
  ])('types %s by its second line', (party, kind, amount, paymentType) => {
    expect(go2bankEntry(row(party, kind, amount)).paymentType).toBe(paymentType);
  });
});
