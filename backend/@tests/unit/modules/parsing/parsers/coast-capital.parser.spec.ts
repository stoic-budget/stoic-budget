import type { PdfTextRow } from '@/common/utils/pdf-parser.util';
import { BankName, FileType } from '@/entities/statement.entity';
import type { LayoutTransaction } from '@/modules/parsing/helpers/pdf-layout-table.helper';
import {
  CoastCapitalParser,
  coastCapitalEntry,
  coastCapitalPayee,
  isCoastCapitalStatement,
} from '@/modules/parsing/parsers/coast-capital.parser';

const STATEMENT = [
  'MEMBER NUMBER',
  '1234567',
  'Statement of Account for',
  'Your agreement with Coast Capital Savings Federal Credit Union (CCS) requires you to notify CCS',
].join('\n');

const line = (text: string, y: number, page = 1): PdfTextRow => ({ text, y, page, items: [] });

const entry = (description: string, y: number): LayoutTransaction => ({
  date: { day: 1, month: 8, year: 2023 },
  dateText: '01 AUG 23',
  description,
  firstLine: '',
  counterparty: '',
  at: { page: 1, y },
});

describe('CoastCapitalParser', () => {
  it('knows its statement by the credit union name and the member number box', () => {
    expect(isCoastCapitalStatement(STATEMENT)).toBe(true);
    expect(isCoastCapitalStatement('Coast Capital Savings Federal Credit Union')).toBe(false);
    expect(isCoastCapitalStatement('MEMBER NUMBER\nPre-Auth Debit COAST CAPITAL')).toBe(false);
  });

  it('parses its files under its own bank or OTHER, and PDFs only', async () => {
    const parser = new CoastCapitalParser();
    const claims = (bank: BankName, type = FileType.PDF) =>
      parser.canParse(bank, type, 'x.pdf', STATEMENT);
    await expect(claims(BankName.COAST_CAPITAL)).resolves.toBe(true);
    await expect(claims(BankName.OTHER)).resolves.toBe(true);
    await expect(claims(BankName.CIBC)).resolves.toBe(false);
    await expect(claims(BankName.COAST_CAPITAL, FileType.CSV)).resolves.toBe(false);
  });

  it('takes the other party from the third line, after the reference and member name', () => {
    const rows = [
      line('01 AUG 23 Pre-Auth Debit 152.44 763.75', 100),
      line('ACME TILES LTD', 109),
      line('EXAMPLE INSURER', 118),
      line('01 AUG 23 Cheque 450.00 313.75', 130),
      line('4309', 139),
      line('02 AUG 23 Deposit 500.00 813.75', 150),
    ];
    const debit = entry('Pre-Auth Debit ACME TILES LTD EXAMPLE INSURER', 100);
    expect(coastCapitalPayee(debit, rows)).toBe('EXAMPLE INSURER');
    expect(coastCapitalPayee(entry('Cheque 4309', 130), rows)).toBe('');
    expect(coastCapitalPayee(entry('Deposit', 150), rows)).toBe('');
  });

  it('types an entry by its first words and keeps a cheque number', () => {
    const row = (paymentPurpose: string) =>
      coastCapitalEntry({
        transactionDate: new Date(2023, 7, 1),
        counterpartyName: '',
        paymentPurpose,
        currency: 'CAD',
      });
    expect(row('Pre-Auth Debit ACME TILES LTD EXAMPLE INSURER').paymentType).toBe('direct_debit');
    expect(row('Direct Deposit DP000 ACME TILES LTD EXAMPLE PAYMENTS').paymentType).toBe(
      'bank_transfer_in',
    );
    expect(row('Service Charge').paymentType).toBe('fee');
    expect(row('Official Draft Fee AC-100').paymentType).toBe('fee');
    expect(row('Interest - Capitalise').paymentType).toBe('interest');
    expect(row('Deposit').paymentType).toBeUndefined();
    expect(row('Cheque 4309')).toMatchObject({ documentNumber: '4309' });
    expect(row('Cheque 4309').paymentType).toBeUndefined();
  });
});
