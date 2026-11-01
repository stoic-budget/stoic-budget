import { BankName, FileType } from '@/entities/statement.entity';
import {
  CitiParser,
  citiPayee,
  citiPaymentType,
  isCitiStatement,
} from '@/modules/parsing/parsers/citi.parser';

const STATEMENT = [
  'Your Citibank Account Statement as on Aug 1, 2024',
  'Date Transaction Details Withdrawals (INR) Deposits (INR) Balance(INR)',
].join('\n');

describe('CitiParser', () => {
  it('knows its statement by the title and the table heading', () => {
    expect(isCitiStatement(STATEMENT)).toBe(true);
    expect(isCitiStatement('Your Citibank Account Statement as on Aug 1, 2024')).toBe(false);
    expect(isCitiStatement('Date Transaction Details')).toBe(false);
  });

  it('claims a PDF named Citi or unnamed, and no other bank', async () => {
    const parser = new CitiParser();
    expect(await parser.canParse(BankName.CITI, FileType.PDF, 'x.pdf', STATEMENT)).toBe(true);
    expect(await parser.canParse(BankName.OTHER, FileType.PDF, 'x.pdf', STATEMENT)).toBe(true);
    expect(await parser.canParse(BankName.ANZ, FileType.PDF, 'x.pdf', STATEMENT)).toBe(false);
    expect(await parser.canParse(BankName.CITI, FileType.CSV, 'x.csv', STATEMENT)).toBe(false);
  });

  it('types an IMPS, NEFT or UPI entry by the column it stands in', () => {
    expect(citiPaymentType('IMPS OUTWARD ORG UPI To shop@bank,REF NO - 1', false)).toBe('bank_transfer_out');
    expect(citiPaymentType('IMPS INWARD ORG UPI From person@bank,REF NO - 1', true)).toBe('bank_transfer_in');
    expect(citiPaymentType('NEFT INWARD NEFT IN UTR X1 FROM EXAMPLE CO', true)).toBe('bank_transfer_in');
    expect(citiPaymentType('CLOSING BALANCE', false)).toBeNull();
  });

  it('takes the other side of an entry', () => {
    expect(citiPayee('IMPS OUTWARD ORG UPI To shop@bank,REF NO - 209287966094, Pay')).toBe('shop@bank');
    expect(citiPayee('IMPS INWARD ORG UPI From person@bank,REF NO - 1, UPI')).toBe('person@bank');
    expect(citiPayee('IMPS OUTWARD ORG IMPS TO 910000000000 - EXAMPLE PAYMENTS BANK LTD REF NO:-1-NAME .')).toBe('EXAMPLE PAYMENTS BANK LTD');
    expect(citiPayee('IMPS INWARD ORG IMPSTO from Example Pay 2 EXAMPLE BANK LIMITED REF NO: - 1')).toBe('Example Pay 2 EXAMPLE BANK LIMITED');
    expect(citiPayee('NEFT INWARD NEFT IN UTR CITIN1 FROM EXAMPLE TRAINING TECHNOL 26997602691DCTXN REF')).toBe('EXAMPLE TRAINING TECHNOL');
    expect(citiPayee('Opening balance')).toBe('');
  });
});
