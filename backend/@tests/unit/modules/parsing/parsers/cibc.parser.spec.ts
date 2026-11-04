import { BankName, FileType } from '@/entities/statement.entity';
import {
  CibcParser,
  cibcPayee,
  cibcPaymentType,
  isCibcStatement,
} from '@/modules/parsing/parsers/cibc.parser';

const STATEMENT = ['CIBC Account Statement', 'Transaction details'].join('\n');

describe('CibcParser', () => {
  it('knows its statement by the title and the table heading', () => {
    expect(isCibcStatement(STATEMENT)).toBe(true);
    expect(isCibcStatement('CIBC Account Statement')).toBe(false);
    expect(isCibcStatement('Transaction details')).toBe(false);
  });

  it('claims a PDF named CIBC or unnamed, and no other bank', async () => {
    const parser = new CibcParser();
    expect(await parser.canParse(BankName.CIBC, FileType.PDF, 'x.pdf', STATEMENT)).toBe(true);
    expect(await parser.canParse(BankName.OTHER, FileType.PDF, 'x.pdf', STATEMENT)).toBe(true);
    expect(await parser.canParse(BankName.ANZ, FileType.PDF, 'x.pdf', STATEMENT)).toBe(false);
    expect(await parser.canParse(BankName.CIBC, FileType.CSV, 'x.csv', STATEMENT)).toBe(false);
  });

  it('types an entry by how it starts, a transfer by its column', () => {
    expect(cibcPaymentType('RETAIL PURCHASE EXAMPLE CAFE', false)).toBe('card');
    expect(cibcPaymentType('VISA DEBIT RETAIL PURCHASE EXAMPLE SHOP', false)).toBe('card');
    expect(cibcPaymentType('INSTANT TELLER WITHDRAWAL EXAMPLE ATM', false)).toBe('cash');
    expect(cibcPaymentType('PREAUTHORIZED DEBIT EXAMPLE INSURANCE', false)).toBe('direct_debit');
    expect(cibcPaymentType('INTERNET BILL PAY EXAMPLE CARD', false)).toBe('bank_transfer_out');
    expect(cibcPaymentType('E-TRANSFER INTERNET TRANSFER', true)).toBe('bank_transfer_in');
    expect(cibcPaymentType('INTERNET TRANSFER', false)).toBe('bank_transfer_out');
    expect(cibcPaymentType('MONTHLY FIXED OVERDRAFT FEE', false)).toBe('fee');
    expect(cibcPaymentType('DEPOSIT', true)).toBeNull();
  });

  it('takes the merchant after the type, and none for a transfer or a withdrawal', () => {
    expect(cibcPayee('RETAIL PURCHASE EXAMPLE CAFE #21')).toBe('EXAMPLE CAFE #21');
    expect(cibcPayee('PREAUTHORIZED DEBIT EXAMPLE INSURANCE')).toBe('EXAMPLE INSURANCE');
    expect(cibcPayee('E-TRANSFER INTERNET TRANSFER')).toBe('');
    expect(cibcPayee('INSTANT TELLER WITHDRAWAL EXAMPLE ATM')).toBe('');
  });
});
