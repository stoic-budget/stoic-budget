import { BankName, FileType } from '@/entities/statement.entity';
import {
  CapitalOneParser,
  capitalOnePayee,
  capitalOnePaymentType,
  isCapitalOneStatement,
} from '@/modules/parsing/parsers/capital-one.parser';

const STATEMENT = [
  "Here's your July 2023 bank statement.",
  'Account Summary Cashflow Summary',
  '360 Checking - 12345678901',
  'capitalone.com 1-888-464-0727',
].join('\n');

describe('CapitalOneParser', () => {
  it('knows its statement by the web address and the cashflow summary', () => {
    expect(isCapitalOneStatement(STATEMENT)).toBe(true);
    expect(isCapitalOneStatement('capitalone.com 1-888-464-0727')).toBe(false);
    expect(isCapitalOneStatement('Cashflow Summary')).toBe(false);
  });

  it('claims a PDF named Capital One or unnamed, and no other bank', async () => {
    const parser = new CapitalOneParser();
    expect(await parser.canParse(BankName.CAPITAL_ONE, FileType.PDF, 'x.pdf', STATEMENT)).toBe(true);
    expect(await parser.canParse(BankName.OTHER, FileType.PDF, 'x.pdf', STATEMENT)).toBe(true);
    expect(await parser.canParse(BankName.ANZ, FileType.PDF, 'x.pdf', STATEMENT)).toBe(false);
    expect(await parser.canParse(BankName.CAPITAL_ONE, FileType.CSV, 'x.csv', STATEMENT)).toBe(false);
  });

  it('types a line by how it starts', () => {
    expect(capitalOnePaymentType('Deposit from ACME PAYROLL')).toBe('bank_transfer_in');
    expect(capitalOnePaymentType('Withdrawal from ACME BROKER ACH')).toBe('bank_transfer_out');
    expect(capitalOnePaymentType('Monthly Interest Paid')).toBe('interest');
    expect(capitalOnePaymentType('Opening Balance')).toBeNull();
  });

  it('takes the other party of a transfer line as the payee', () => {
    expect(capitalOnePayee('Withdrawal from ACME BROKER ACH TRANSF')).toBe('ACME BROKER ACH TRANSF');
    expect(capitalOnePayee('Monthly Interest Paid')).toBe('');
  });
});
