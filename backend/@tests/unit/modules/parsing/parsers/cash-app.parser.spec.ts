import { BankName, FileType } from '@/entities/statement.entity';
import {
  CashAppParser,
  cashAppPayee,
  cashAppPaymentType,
  isCashAppStatement,
} from '@/modules/parsing/parsers/cash-app.parser';

const STATEMENT = ['April 2025', 'Account Statement', 'Cash App Example Person', 'Money In'].join('\n');

describe('CashAppParser', () => {
  it('knows its statement by the issuer name and the title', () => {
    expect(isCashAppStatement(STATEMENT)).toBe(true);
    expect(isCashAppStatement('Cash App Example Person')).toBe(false);
    expect(isCashAppStatement('Account Statement')).toBe(false);
  });

  it('claims a PDF named Cash App or unnamed, and no other bank', async () => {
    const parser = new CashAppParser();
    expect(await parser.canParse(BankName.CASH_APP, FileType.PDF, 'x.pdf', STATEMENT)).toBe(true);
    expect(await parser.canParse(BankName.OTHER, FileType.PDF, 'x.pdf', STATEMENT)).toBe(true);
    expect(await parser.canParse(BankName.ANZ, FileType.PDF, 'x.pdf', STATEMENT)).toBe(false);
    expect(await parser.canParse(BankName.CASH_APP, FileType.CSV, 'x.csv', STATEMENT)).toBe(false);
  });

  it('takes the other party out of the description, without the details after it', () => {
    expect(cashAppPayee('To Example Person Cash App payment')).toBe('Example Person');
    expect(cashAppPayee('From Example Bank x0000 Standard transfer')).toBe('Example Bank x0000');
    expect(cashAppPayee('Example Shop Anytown Cash App Card')).toBe('Example Shop Anytown');
    expect(cashAppPayee('Cash App Loan repayment (#ABC123)')).toBe('Cash App');
    expect(cashAppPayee('Cash Invest ACME BUY trade Stock buy')).toBe('Cash Invest ACME BUY trade');
    expect(cashAppPayee('Savings Transfer')).toBe('');
  });

  it('types a card payment by its details and a transfer by its direction', () => {
    expect(cashAppPaymentType('Example Shop Cash App Card', false)).toBe('card');
    expect(cashAppPaymentType('To Example Person Cash App payment', false)).toBe('bank_transfer_out');
    expect(cashAppPaymentType('From Example Person Cash App payment', true)).toBe('bank_transfer_in');
    expect(cashAppPaymentType('To Example Visa x0000 Instant transfer', false)).toBe('bank_transfer_out');
    expect(cashAppPaymentType('sale of BTC 0.001 Bitcoin sale', true)).toBeNull();
  });
});
