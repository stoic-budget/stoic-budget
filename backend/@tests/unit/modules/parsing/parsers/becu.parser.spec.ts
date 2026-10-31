import { BankName, FileType } from '@/entities/statement.entity';
import {
  BecuParser,
  becuPayee,
  becuPaymentType,
  becuSummaryBalances,
  isBecuStatement,
} from '@/modules/parsing/parsers/becu.parser';

const STATEMENT = [
  'Summary of Deposit Account Activity',
  'Deposit Account Activity',
  "Example Credit Union",
  "Boeing Employees' Credit Union",
].join('\n');

describe('BecuParser', () => {
  it('knows its statement by the credit union name and the activity heading', () => {
    expect(isBecuStatement(STATEMENT)).toBe(true);
    expect(isBecuStatement("Boeing Employees’ Credit Union\nDeposit Account Activity")).toBe(true);
    expect(isBecuStatement("Boeing Employees' Credit Union")).toBe(false);
    expect(isBecuStatement('Deposit Account Activity')).toBe(false);
  });

  it('claims a PDF named BECU or unnamed, and no other bank', async () => {
    const parser = new BecuParser();
    expect(await parser.canParse(BankName.BECU, FileType.PDF, 'x.pdf', STATEMENT)).toBe(true);
    expect(await parser.canParse(BankName.OTHER, FileType.PDF, 'x.pdf', STATEMENT)).toBe(true);
    expect(await parser.canParse(BankName.ALLY, FileType.PDF, 'x.pdf', STATEMENT)).toBe(false);
    expect(await parser.canParse(BankName.BECU, FileType.CSV, 'x.csv', STATEMENT)).toBe(false);
  });

  it('types a line by how it starts', () => {
    expect(becuPaymentType('POS Withdrawal ACME CAFE 1 MAIN ST Machine# 1 Trace# 2')).toBe('card');
    expect(becuPaymentType('External Deposit ACME PAY - CASHOUT')).toBe('bank_transfer_in');
    expect(becuPaymentType('Deposit Online Banking Transfer from 1000000001 SAV')).toBe(
      'bank_transfer_in',
    );
    expect(becuPaymentType('Withdrawal Online Banking Transfer To 1000000002 CK')).toBe(
      'bank_transfer_out',
    );
    expect(becuPaymentType('Dividend Credit')).toBeNull();
  });

  it('names the payee without the store number, the address and the terminal note', () => {
    expect(
      becuPayee('POS Withdrawal 14 ACME CAFE 710 FRONT STREET EXAMPLETOWN Machine# A1 Trace# 000'),
    ).toBe('ACME CAFE');
    expect(becuPayee('POS Withdrawal ACME BAR #8412 4749 MAIN WAY NE Machine# 8 Trace# 0')).toBe(
      'ACME BAR #8412',
    );
    expect(becuPayee('External Deposit ACME PAY - CASHOUT')).toBe('ACME PAY - CASHOUT');
  });

  it('leaves a transfer between the member’s own accounts without a payee', () => {
    expect(becuPayee('Withdrawal Online Banking Transfer To 1000000002 CK')).toBe('');
  });

  it('reads each account’s balances off the summary table', () => {
    const text = [
      ' Example Savings            1000000001      7.62     (7.62)                         0.00',
      ' Checking                   1000000002     55.28   (222.03)     166.87              0.12',
      ' Overdraft Fees             0.00           0.00',
    ].join('\n');
    expect(becuSummaryBalances(text)).toEqual(
      new Map([
        ['1000000001', { start: 7.62, end: 0 }],
        ['1000000002', { start: 55.28, end: 0.12 }],
      ]),
    );
  });
});
