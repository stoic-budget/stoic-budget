import { BankName, FileType } from '@/entities/statement.entity';
import { mentionedBank } from '@/modules/parsing/helpers/pdf-layout-fingerprint.helper';
import type { ParsedTransaction } from '@/modules/parsing/interfaces/parsed-statement.interface';
import { RbsParser, isRbsStatement, rbsEntry } from '@/modules/parsing/parsers/rbs.parser';

const STATEMENT = ['BIC: RBOSGB2L', 'Royal Bank of Scotland Plc. Registered Office, The Mound, Edinburgh'].join('\n');

const row = (paymentPurpose: string, amount: { debit?: number; credit?: number }): ParsedTransaction => ({
  transactionDate: new Date(2023, 5, 24),
  paymentPurpose,
  counterpartyName: paymentPurpose,
  currency: 'GBP',
  ...amount,
});

describe('RbsParser', () => {
  it('knows its statement by its name and BIC, not as Bank of Scotland', () => {
    expect(isRbsStatement(STATEMENT)).toBe(true);
    expect(isRbsStatement('Transfer to Royal Bank of Scotland')).toBe(false);
    expect(mentionedBank(STATEMENT.toLowerCase())).toBe(BankName.RBS);
  });

  it('parses its files under its own bank or OTHER, and PDFs only', async () => {
    const parser = new RbsParser();
    const claims = (bank: BankName, type = FileType.PDF) =>
      parser.canParse(bank, type, 'x.pdf', STATEMENT);
    await expect(claims(BankName.RBS)).resolves.toBe(true);
    await expect(claims(BankName.OTHER)).resolves.toBe(true);
    await expect(claims(BankName.NATWEST)).resolves.toBe(false);
    await expect(claims(BankName.RBS, FileType.CSV)).resolves.toBe(false);
  });

  it.each([
    ['Faster Payment ACME Store', { debit: 132.3 }, 'ACME Store', 'bank_transfer_out'],
    ['DD ACME Energy', { debit: 2470 }, 'ACME Energy', 'direct_debit'],
    ['Int. Bank Interest Paid', { credit: 9.33 }, 'Interest Paid', 'interest'],
  ])('reads %s', (purpose, amount, payee, paymentType) => {
    expect(rbsEntry(row(purpose, amount))).toMatchObject({ counterpartyName: payee, paymentType });
  });
});
