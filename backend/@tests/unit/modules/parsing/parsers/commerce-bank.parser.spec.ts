import { BankName, FileType } from '@/entities/statement.entity';
import type { ParsedTransaction } from '@/modules/parsing/interfaces/parsed-statement.interface';
import {
  CommerceBankParser,
  commerceEntry,
  commercePayee,
  isCommerceBankStatement,
} from '@/modules/parsing/parsers/commerce-bank.parser';

const STATEMENT = [
  'Bank Statement Primary Account Number: 100000001',
  'If you have questions about your statement, please call us at 800-453-BANK.',
  'Visit your Commerce Banker or go to commercebank.com to learn more.',
].join('\n');

const row = (paymentPurpose: string, amount: { debit?: number; credit?: number }): ParsedTransaction => ({
  transactionDate: new Date(2021, 0, 4),
  paymentPurpose,
  counterpartyName: paymentPurpose,
  currency: 'USD',
  ...amount,
});

describe('CommerceBankParser', () => {
  it('knows its statement by the web address and the bank line', () => {
    expect(isCommerceBankStatement(STATEMENT)).toBe(true);
    expect(isCommerceBankStatement('Payment to commercebank.com')).toBe(false);
  });

  it('parses its files under its own bank or OTHER, and PDFs only', async () => {
    const parser = new CommerceBankParser();
    const claims = (bank: BankName, type = FileType.PDF) =>
      parser.canParse(bank, type, 'x.pdf', STATEMENT);
    await expect(claims(BankName.COMMERCE_BANK)).resolves.toBe(true);
    await expect(claims(BankName.OTHER)).resolves.toBe(true);
    await expect(claims(BankName.COMMBANK)).resolves.toBe(false);
    await expect(claims(BankName.COMMERCE_BANK, FileType.CSV)).resolves.toBe(false);
  });

  it('names the merchant under a PIN purchase, without its terminal and town', () => {
    const description = 'Debit Card Purchase-Pin ACME Service Station 40000001 Sampletown IL 10000001';
    expect(commercePayee({ firstLine: 'Debit Card Purchase-Pin', description })).toBe('ACME Service Station');
  });

  it('names the payer before an electronic payment reference, a signed purchase by its first line', () => {
    expect(
      commercePayee({
        firstLine: 'Example Payroll Treas 310 Ref Nbr: 100000000001',
        description: 'Example Payroll Treas 310 Ref Nbr: 100000000001 Trace No: 100000000000001',
      }),
    ).toBe('Example Payroll Treas 310');
    expect(commercePayee({ firstLine: 'ACME Cafe', description: 'ACME Cafe Sampletown IL' })).toBe('ACME Cafe');
    expect(commercePayee({ firstLine: 'ATM Withdrawal', description: 'ATM Withdrawal 1 Sample St' })).toBe('');
  });

  it.each([
    ['ATM Foreign Fee 1 Sample St P000001 Sampletown IL 10000001', { debit: 2.95 }, 'fee'],
    ['ATM DDA Inquiry Foreign Fee 1 Sample St P000001', { debit: 2.95 }, 'fee'],
    ['ATM Withdrawal 1 Sample St P000001 Sampletown IL 10000001', { debit: 62 }, 'cash'],
    ['Debit Card Purchase-Pin ACME Store 40000001 Sampletown IL 10000001', { debit: 15 }, 'card'],
    ['ACME Cafe Sampletown IL', { debit: 8.18 }, 'card'],
    ['Statement Fee', { debit: 4 }, 'fee'],
    ['Example Payroll Treas 310 Ref Nbr: 100000000001 Trace No: 1', { credit: 600 }, 'bank_transfer_in'],
    ['Payment ACME Credit Ref Nbr: 100000000002 Trace No: 2', { debit: 53.5 }, 'direct_debit'],
  ])('types %s', (purpose, amount, paymentType) => {
    expect(commerceEntry(row(purpose, amount)).paymentType).toBe(paymentType);
  });

  it('keeps an electronic payment reference as its document number', () => {
    expect(
      commerceEntry(row('Payment ACME Credit Ref Nbr: 100000000002 Trace No: 2', { debit: 53.5 })).documentNumber,
    ).toBe('100000000002');
  });
});
