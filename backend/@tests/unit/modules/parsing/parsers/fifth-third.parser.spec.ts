import type { PdfTextRow } from '@/common/utils/pdf-parser.util';
import { BankName, FileType } from '@/entities/statement.entity';
import type { LayoutTransaction } from '@/modules/parsing/helpers/pdf-layout-table.helper';
import type { ParsedTransaction } from '@/modules/parsing/interfaces/parsed-statement.interface';
import {
  FifthThirdParser,
  fifthThirdEntry,
  isFifthThirdStatement,
  signByHeading,
} from '@/modules/parsing/parsers/fifth-third.parser';

const STATEMENT = ['STATEMENT OF ACCOUNT', 'Fifth Third Business Plus', 'ACCOUNT SUMMARY'].join('\n');

const line = (text: string, y: number): PdfTextRow => ({ page: 1, y, text, items: [] });
const read = (description: string, y: number, credit: number): LayoutTransaction => ({
  date: { day: 4, month: 2 },
  dateText: '02/04',
  description,
  firstLine: description,
  counterparty: '',
  credit,
  at: { page: 1, y },
});

describe('FifthThirdParser', () => {
  it('knows its statement by the bank and the title', () => {
    expect(isFifthThirdStatement(STATEMENT)).toBe(true);
    expect(isFifthThirdStatement('Transfer to Fifth Third')).toBe(false);
  });

  it('parses its files under its own bank or OTHER, and PDFs only', async () => {
    const parser = new FifthThirdParser();
    const claims = (bank: BankName, type = FileType.PDF) =>
      parser.canParse(bank, type, 'x.pdf', STATEMENT);
    await expect(claims(BankName.FIFTH_THIRD)).resolves.toBe(true);
    await expect(claims(BankName.OTHER)).resolves.toBe(true);
    await expect(claims(BankName.CHASE)).resolves.toBe(false);
    await expect(claims(BankName.FIFTH_THIRD, FileType.CSV)).resolves.toBe(false);
  });

  it('signs each row by the list printed above it and drops the subtotals', () => {
    const rows = [line('DEPOSITS', 100), line('ELECTRONIC PAYMENTS', 300)];
    const signed = signByHeading(rows, [
      read('CASH DEPOSIT', 120, 2500),
      read('ACME STORE Subtotal:', 320, 70),
      read('Subtotal:', 340, 70),
    ]);
    expect(signed.map(row => [row.description, row.credit, row.debit])).toEqual([
      ['CASH DEPOSIT', 2500, undefined],
      ['ACME STORE', undefined, 70],
    ]);
  });

  it('types a card purchase, a cash withdrawal and an ACH debit', () => {
    const row = (paymentPurpose: string): ParsedTransaction => ({
      transactionDate: new Date(2020, 1, 4),
      paymentPurpose,
      counterpartyName: paymentPurpose,
      currency: 'USD',
      debit: 10,
    });
    expect(fifthThirdEntry(row('DEBIT CARD PURCHASE, AUT 120319 VISA')).paymentType).toBe('card');
    expect(fifthThirdEntry(row('ATM CASH WITHDRAW AUT122419')).paymentType).toBe('cash');
    expect(fifthThirdEntry(row('ACH DEBIT, ACME CHK ORDERS')).paymentType).toBe('direct_debit');
  });
});
