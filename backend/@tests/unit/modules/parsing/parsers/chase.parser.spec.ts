import { BankName, FileType } from '@/entities/statement.entity';
import {
  ChaseParser,
  chasePayee,
  chasePaymentType,
  isChaseStatement,
} from '@/modules/parsing/parsers/chase.parser';

const STATEMENT = [
  'January 01, 2025 through March 31, 2025',
  'JPMorgan Chase Bank, N.A.',
  'TRANSACTION DETAIL',
].join('\n');

describe('ChaseParser', () => {
  it('knows its statement by the registered name and the table heading', () => {
    expect(isChaseStatement(STATEMENT)).toBe(true);
    expect(isChaseStatement('JPMorgan Chase Bank, N.A.')).toBe(false);
    expect(isChaseStatement('TRANSACTION DETAIL')).toBe(false);
  });

  it('claims a PDF named Chase or unnamed, and no other bank', async () => {
    const parser = new ChaseParser();
    expect(await parser.canParse(BankName.CHASE, FileType.PDF, 'x.pdf', STATEMENT)).toBe(true);
    expect(await parser.canParse(BankName.OTHER, FileType.PDF, 'x.pdf', STATEMENT)).toBe(true);
    expect(await parser.canParse(BankName.ANZ, FileType.PDF, 'x.pdf', STATEMENT)).toBe(false);
    expect(await parser.canParse(BankName.CHASE, FileType.CSV, 'x.csv', STATEMENT)).toBe(false);
  });

  it('types an entry by its words and, for transfers, by the direction', () => {
    expect(chasePaymentType('Card Purchase 01/09 Example Cafe Anytown IL Card 0000', false)).toBe('card');
    expect(chasePaymentType('Card Purchase Return 02/24 Example Shop NV Card 0000', true)).toBe('card');
    expect(chasePaymentType('Monthly Service Fee', false)).toBe('fee');
    expect(chasePaymentType('Zelle Payment From Example Person Abc1234def5', true)).toBe('bank_transfer_in');
    expect(chasePaymentType('Zelle Payment To Example Person Abc1234def5', false)).toBe('bank_transfer_out');
    expect(chasePaymentType('Online Transfer To Chk ...0000 Transaction#: 1', false)).toBe('bank_transfer_out');
    expect(chasePaymentType('Example Co Payroll PPD ID: 1234567890', true)).toBe('bank_transfer_in');
    expect(chasePaymentType('Example Loan Pymt PPD ID: 1234567890', false)).toBe('direct_debit');
    expect(chasePaymentType('Beginning Balance', false)).toBeNull();
  });

  it('takes the other side of an entry without its dates, codes and card', () => {
    expect(chasePayee('Card Purchase 01/09 Py *Example Cafe Anytown IL Card 0000')).toBe('Py *Example Cafe Anytown IL');
    expect(chasePayee('Card Purchase With Pin 03/04 Example Shop Anytown CA Card 0000')).toBe('Example Shop Anytown CA');
    expect(chasePayee('Zelle Payment From Example Kitchen Inc Bach1234abcd')).toBe('Example Kitchen Inc');
    expect(chasePayee('Zelle Payment To Wife Jpm999Vvcjwg')).toBe('Wife');
    expect(chasePayee('01/15 Online Transfer To Chk ...0000 Transaction#: 17177940940')).toBe('Online Transfer To Chk ...0000');
    expect(chasePayee('Example Co Payroll PPD ID: 1234567890')).toBe('Example Co Payroll');
    expect(chasePayee('Monthly Service Fee')).toBe('');
  });
});
