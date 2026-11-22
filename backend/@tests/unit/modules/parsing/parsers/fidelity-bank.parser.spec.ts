import { BankName, FileType } from '@/entities/statement.entity';
import type { ParsedTransaction } from '@/modules/parsing/interfaces/parsed-statement.interface';
import {
  FidelityBankParser,
  fidelityBankEntry,
  isFidelityBankStatement,
} from '@/modules/parsing/parsers/fidelity-bank.parser';

const STATEMENT = [
  'www.fidelitybank.ng',
  'Currency: NGN',
  'Transaction Value Date Channel Details Pay In Pay Out Balance',
].join('\n');

const row = (paymentPurpose: string, amount: { debit?: number; credit?: number }): ParsedTransaction => ({
  transactionDate: new Date(2024, 3, 2),
  paymentPurpose,
  counterpartyName: paymentPurpose,
  currency: 'NGN',
  ...amount,
});

describe('FidelityBankParser', () => {
  it('knows its statement by the bank site and the money columns', () => {
    expect(isFidelityBankStatement(STATEMENT)).toBe(true);
    expect(isFidelityBankStatement('Fidelity Investments brokerage statement')).toBe(false);
  });

  it('parses its files under its own bank or OTHER, and PDFs only', async () => {
    const parser = new FidelityBankParser();
    const claims = (bank: BankName, type = FileType.PDF) =>
      parser.canParse(bank, type, 'x.pdf', STATEMENT);
    await expect(claims(BankName.FIDELITY_BANK)).resolves.toBe(true);
    await expect(claims(BankName.OTHER)).resolves.toBe(true);
    await expect(claims(BankName.ABSA)).resolves.toBe(false);
    await expect(claims(BankName.FIDELITY_BANK, FileType.CSV)).resolves.toBe(false);
  });

  it.each([
    ['ONB TRF TO ACME PAY C **3435 - ACME-BANK', { debit: 1010.75 }, 'ACME PAY C', 'bank_transfer_out'],
    ['770 TRANSFER TO Member Two 0100000001 GTB', { debit: 1010.75 }, 'Member Two', 'bank_transfer_out'],
    ['MEMBER ONE/Transfer from MEMBER ONE', { credit: 7000 }, 'MEMBER ONE', 'bank_transfer_in'],
    ['SMS ALERT CHARGES 29MAR 24', { debit: 12 }, 'SMS ALERT CHARGES 29MAR 24', 'fee'],
  ])('reads %s', (purpose, amount, payee, paymentType) => {
    expect(fidelityBankEntry(row(purpose, amount))).toMatchObject({ counterpartyName: payee, paymentType });
  });
});
