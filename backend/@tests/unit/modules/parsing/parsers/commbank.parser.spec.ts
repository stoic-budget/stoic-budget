import { BankName, FileType } from '@/entities/statement.entity';
import type { ParsedTransaction } from '@/modules/parsing/interfaces/parsed-statement.interface';
import {
  CommBankParser,
  commBankEntry,
  isCommBankStatement,
} from '@/modules/parsing/parsers/commbank.parser';

const STATEMENT = [
  'Commonwealth Bank of Australia',
  'ABN 00 000 000 000 AFSL and',
  'Transaction Summary',
  'Account Number 062-000 10000001',
].join('\n');

const row = (paymentPurpose: string, amount: { debit?: number; credit?: number }): ParsedTransaction => ({
  transactionDate: new Date(2022, 0, 19),
  paymentPurpose,
  counterpartyName: paymentPurpose,
  currency: 'AUD',
  ...amount,
});

describe('CommBankParser', () => {
  it('knows its statement by the bank name and the summary title', () => {
    expect(isCommBankStatement(STATEMENT)).toBe(true);
    expect(isCommBankStatement('Transfer to Commonwealth Bank of Australia')).toBe(false);
    expect(isCommBankStatement('Transaction Summary')).toBe(false);
  });

  it('parses its files under its own bank or OTHER, and PDFs only', async () => {
    const parser = new CommBankParser();
    const claims = (bank: BankName, type = FileType.PDF) =>
      parser.canParse(bank, type, 'x.pdf', STATEMENT);
    await expect(claims(BankName.COMMBANK)).resolves.toBe(true);
    await expect(claims(BankName.OTHER)).resolves.toBe(true);
    await expect(claims(BankName.COMERICA)).resolves.toBe(false);
    await expect(claims(BankName.COMMBANK, FileType.CSV)).resolves.toBe(false);
  });

  it.each([
    ['ACME STORE SAMPLETOWN AUS Card xx1234', { debit: 50.95 }, 'card', 'ACME STORE SAMPLETOWN AUS'],
    ['ACME CAFE SAMPLETOWN', { debit: 10.25 }, 'card', 'ACME CAFE SAMPLETOWN'],
    ['ACME MARKET SAMPLETOWN VIC AU Cash Out $100.00 Purchase $20.00', { debit: 120 }, 'card', 'ACME MARKET SAMPLETOWN VIC AU'],
    ['Direct Debit 123456 ACME PAYMENTS J000000000AB', { debit: 37 }, 'direct_debit', 'ACME PAYMENTS'],
    ['Direct Credit 123456 WAGES Acme Care Services Ltd', { credit: 2448 }, 'bank_transfer_in', 'WAGES Acme Care Services Ltd'],
    ['Direct Credit Child Support', { credit: 2550 }, 'bank_transfer_in', 'Child Support'],
    ['Transfer from MEMBER ONE CommBank app Rent', { credit: 200 }, 'bank_transfer_in', 'MEMBER ONE'],
    ['ACME TELECOM NetBank BPAY 12345 100000000001 Mobile Bill', { debit: 80 }, 'bank_transfer_out', 'ACME TELECOM'],
  ])('reads %s', (purpose, amount, paymentType, payee) => {
    expect(commBankEntry(row(purpose, amount))).toMatchObject({ paymentType, counterpartyName: payee });
  });

  it.each([
    ['Transfer to CBA A/c CommBank app Savings', 'bank_transfer_out'],
    ['Wdl ATM CBA ATM SAMPLETOWN VIC 3000', 'cash'],
    ['Cardless Cash for collection MEMBER', 'cash'],
    ['CASH DEPOSIT CBA ATM SAMPLETOWN VIC 300000 AUS', 'cash'],
    ['Non CBA ATM Withdrawal Fee', 'fee'],
    ['Debit Excess Interest', 'interest'],
  ])('types %s', (purpose, paymentType) => {
    expect(commBankEntry(row(purpose, { debit: 1 })).paymentType).toBe(paymentType);
  });

  it('leaves an unknown credit untyped', () => {
    expect(commBankEntry(row('ACME REFUND', { credit: 5 })).paymentType).toBeUndefined();
  });
});
