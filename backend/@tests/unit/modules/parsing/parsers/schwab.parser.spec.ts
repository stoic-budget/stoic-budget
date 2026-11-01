import { BankName, FileType } from '@/entities/statement.entity';
import {
  isSchwabStatement,
  SchwabParser,
  schwabPayee,
  schwabPaymentType,
} from '@/modules/parsing/parsers/schwab.parser';

const STATEMENT = [
  'Account Number Statement Period',
  'Example Person 000000000000 July 1-31, 2023',
  'Send Written Inquiries to: Charles Schwab Bank',
].join('\n');

describe('SchwabParser', () => {
  it('knows its statement by the registered name and the period heading', () => {
    expect(isSchwabStatement(STATEMENT)).toBe(true);
    expect(isSchwabStatement('Charles Schwab Bank')).toBe(false);
    expect(isSchwabStatement('Statement Period')).toBe(false);
    expect(isSchwabStatement('Deposit from CHARLES SCHWAB ACCTVERIFY\nStatement Period')).toBe(false);
  });

  it('claims a PDF named Schwab or unnamed, and no other bank', async () => {
    const parser = new SchwabParser();
    expect(await parser.canParse(BankName.SCHWAB, FileType.PDF, 'x.pdf', STATEMENT)).toBe(true);
    expect(await parser.canParse(BankName.OTHER, FileType.PDF, 'x.pdf', STATEMENT)).toBe(true);
    expect(await parser.canParse(BankName.ANZ, FileType.PDF, 'x.pdf', STATEMENT)).toBe(false);
    expect(await parser.canParse(BankName.SCHWAB, FileType.CSV, 'x.csv', STATEMENT)).toBe(false);
  });

  it('types an entry by its first line, and a transfer by the column it stands in', () => {
    expect(schwabPaymentType('Visa Debit Card Point of Sale Purchase Example Cafe, NM, US', false)).toBe('card');
    expect(schwabPaymentType('ATM Withdrawal Example Bank Anytown, NM, US', false)).toBe('cash');
    expect(schwabPaymentType('Interest Paid', true)).toBe('interest');
    expect(schwabPaymentType('Electronic Deposit EXAMPLE CO DIRECT DEP', true)).toBe('bank_transfer_in');
    expect(schwabPaymentType('Electronic Withdrawal EXAMPLE LOAN', false)).toBe('bank_transfer_out');
    expect(schwabPaymentType('Money Transfer Visa Direct EXAMPLE APP', true)).toBe('bank_transfer_in');
    expect(schwabPaymentType('Transfer to Schwab Bank Investor Checking -0000', false)).toBe('bank_transfer_out');
    expect(schwabPaymentType('Beginning Balance', false)).toBeNull();
  });

  it('takes the other side of an entry without its place or ACH tail', () => {
    expect(schwabPayee('Visa Debit Card Point of Sale Purchase Example Cafe 12, NM, US')).toBe('Example Cafe 12');
    expect(schwabPayee('Electronic Deposit EXAMPLE CO DIRECT DEP 230707~ Tran: ACHDD')).toBe(
      'EXAMPLE CO DIRECT DEP 230707',
    );
    expect(schwabPayee('Transfer from Schwab Bank Investor Checking -0000')).toBe(
      'Transfer from Schwab Bank Investor Checking -0000',
    );
    expect(schwabPayee('Interest Paid')).toBe('');
  });
});
