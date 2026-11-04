import { BankName, FileType } from '@/entities/statement.entity';
import {
  CitizensParser,
  citizensPayee,
  citizensPaymentType,
  isCitizensStatement,
  readChecks,
} from '@/modules/parsing/parsers/citizens.parser';

const STATEMENT = ['Access your account online:', 'citizensbank.com', 'Balance Calculation'].join('\n');

describe('CitizensParser', () => {
  it('knows its statement by the web address and the balance calculation', () => {
    expect(isCitizensStatement(STATEMENT)).toBe(true);
    expect(isCitizensStatement('citizensbank.com')).toBe(false);
    expect(isCitizensStatement('Balance Calculation')).toBe(false);
  });

  it('claims a PDF named Citizens or unnamed, and no other bank', async () => {
    const parser = new CitizensParser();
    expect(await parser.canParse(BankName.CITIZENS, FileType.PDF, 'x.pdf', STATEMENT)).toBe(true);
    expect(await parser.canParse(BankName.OTHER, FileType.PDF, 'x.pdf', STATEMENT)).toBe(true);
    expect(await parser.canParse(BankName.ANZ, FileType.PDF, 'x.pdf', STATEMENT)).toBe(false);
    expect(await parser.canParse(BankName.CITIZENS, FileType.CSV, 'x.csv', STATEMENT)).toBe(false);
  });

  it('reads the checks table, two blocks to a line, as debits dated in the statement year', () => {
    const text = [
      'Checks Previous Balance',
      'Check # Amount Date Check # Amount Date',
      'Total Checks',
      '193 1,490.00 11/12 195 20.50 11/14',
      '- 1,510.50',
      'Withdrawals & Debits',
    ].join('\n');
    expect(
      readChecks(text, 2023, 'USD').map(row => [row.paymentPurpose, row.debit, row.transactionDate.getMonth(), row.transactionDate.getDate()]),
    ).toEqual([
      ['Check 193', 1490, 10, 12],
      ['Check 195', 20.5, 10, 14],
    ]);
    expect(readChecks('Withdrawals & Debits\n11/01 147.00 3016 DBT PURCHASE', 2023, 'USD')).toEqual([]);
  });

  it('types an entry by its words, a transfer by the section it stands in', () => {
    expect(citizensPaymentType('3016 POS DEBIT - 001 EXAMPLE STORE', false)).toBe('card');
    expect(citizensPaymentType('3016 DBT PURCHASE - 000112 EXAMPLE SALON', false)).toBe('card');
    expect(citizensPaymentType('3016 ATM CASH - RI1248 EXAMPLE ATM', false)).toBe('cash');
    expect(citizensPaymentType('ONLINE TRANSFER TO CHECKING 1234567890', false)).toBe('bank_transfer_out');
    expect(citizensPaymentType('SCHEDULED TRANSFER 1234567890', true)).toBe('bank_transfer_in');
    expect(citizensPaymentType('EXAMPLE CREDIT CRD EPAY 220423 1234567890', false)).toBe('bank_transfer_out');
    expect(citizensPaymentType('OPTI CREDIT FEE ( 1 AT $37 )', false)).toBe('fee');
    expect(citizensPaymentType('PAYPAL DEPOSIT REF 042522', true)).toBe('bank_transfer_in');
    expect(citizensPaymentType('DEPOSIT', true)).toBeNull();
  });

  it('takes the merchant after the terminal code of a card entry', () => {
    expect(citizensPayee('3016 DBT PURCHASE - 035524 EXAMPLE BAR GRAND RAPIDS MI')).toBe('EXAMPLE BAR GRAND RAPIDS MI');
    expect(citizensPayee('3016 ATM CASH - RI1248 EXAMPLE ATM STREET')).toBe('EXAMPLE ATM STREET');
    expect(citizensPayee('SCHEDULED TRANSFER 1234567890')).toBe('');
  });
});
