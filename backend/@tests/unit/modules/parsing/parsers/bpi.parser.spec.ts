import { BankName, FileType } from '@/entities/statement.entity';
import {
  BpiParser,
  bpiPayee,
  bpiPaymentType,
  isBpiStatement,
} from '@/modules/parsing/parsers/bpi.parser';

const STATEMENT = [
  'BPI Express Phone 89-100 . (632) 89-1000',
  'BRANCH: EXAMPLE-CITY PAYROLL ACCOUNT',
  'PERIOD COVERED: DEC 10, 2021 – JUN 30, 2022 NO: 1234-567-890',
].join('\n');

describe('BpiParser', () => {
  it('knows its statement by the phone line and the period line', () => {
    expect(isBpiStatement(STATEMENT)).toBe(true);
    expect(isBpiStatement('BPI Express Phone 89-100')).toBe(false);
    expect(isBpiStatement('PERIOD COVERED: DEC 10, 2021 – JUN 30, 2022')).toBe(false);
    expect(isBpiStatement('FROM:NON-BPI TERMINAL\nPERIOD COVERED: DEC 10, 2021')).toBe(false);
  });

  it('claims a PDF named BPI or unnamed, and no other bank', async () => {
    const parser = new BpiParser();
    expect(await parser.canParse(BankName.BPI, FileType.PDF, 'x.pdf', STATEMENT)).toBe(true);
    expect(await parser.canParse(BankName.OTHER, FileType.PDF, 'x.pdf', STATEMENT)).toBe(true);
    expect(await parser.canParse(BankName.ANZ, FileType.PDF, 'x.pdf', STATEMENT)).toBe(false);
    expect(await parser.canParse(BankName.BPI, FileType.CSV, 'x.csv', STATEMENT)).toBe(false);
  });

  it('types a row by its wording, and a transfer by the column it stands in', () => {
    expect(bpiPaymentType('1411 ATM WDL 0438', false)).toBe('cash');
    expect(bpiPaymentType('1414 EPS AT EN 0000 FROM:NON-BPI TERMINAL', false)).toBe('cash');
    expect(bpiPaymentType('3448 EDL/MB PAY 0189 TO: ACME WALLET CASH IN', false)).toBe(
      'bank_transfer_out',
    );
    expect(bpiPaymentType('4348 EL/ES PAY 1011 INTER-BANK FUND TRANSFER', true)).toBe(
      'bank_transfer_in',
    );
    expect(bpiPaymentType('4348 EL/ES PAY 1011 INTER-BANK FUND TRANSFER', false)).toBe(
      'bank_transfer_out',
    );
    expect(bpiPaymentType('SERVICE CHARGE', false)).toBeNull();
  });

  it('takes the payee of a "TO:" row without the masked number', () => {
    expect(bpiPayee('3448 EDL/MB PAY 0189 TO: ACME WALLET CASH IN …..XXXXX00123')).toBe(
      'ACME WALLET CASH IN',
    );
    expect(bpiPayee('1414 EPS AT EN 0000 FROM:NON-BPI TERMINAL')).toBe('');
  });
});
