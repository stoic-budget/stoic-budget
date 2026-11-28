import type { PdfTextRow } from '@/common/utils/pdf-parser.util';
import type { LayoutTransaction } from '@/modules/parsing/helpers/pdf-layout-table.helper';
import type { ParsedStatement } from '@/modules/parsing/interfaces/parsed-statement.interface';
import { isRevolutStatement, withSummary } from '@/modules/parsing/parsers/revolut.parser';
import { revolutSections, sectionAt, withFees } from '@/modules/parsing/parsers/revolut-sections';

const line = (page: number, y: number, text: string): PdfTextRow => ({
  page,
  y,
  text,
  items: [{ text, x: 40, y, width: text.length * 5, height: 8, page }],
});

const row = (fields: Partial<LayoutTransaction>): LayoutTransaction => ({
  date: { day: 20, month: 3, year: 2026 },
  dateText: 'Mar 20, 2026',
  description: 'Exchanged from EUR',
  firstLine: 'Exchanged from EUR',
  counterparty: 'Exchanged from EUR',
  ...fields,
});

const SUMMARY_EUR = 'Account (Current Account) €10.00 €62.49 €200.00 €147.51';
const SUMMARY_CZK = 'Account (Current Account) 100.00 CZK 857.50 CZK 1,262.50 CZK 505.00 CZK';

describe('revolutSections', () => {
  it("reads each section's summary and IBAN, its first summary being its own", () => {
    const sections = revolutSections([
      'EUR Statement',
      SUMMARY_EUR,
      'CZK Statement',
      'Member One IBAN LT12 3250 0000 0000 0001',
      SUMMARY_CZK,
      'CZK Statement',
      'Account (Current Account) 1.00 CZK 2.00 CZK 3.00 CZK 4.00 CZK',
    ]);
    expect(sections.get('EUR')).toEqual({ currency: 'EUR', start: 10, out: 62.49, in: 200, end: 147.51 });
    expect(sections.get('CZK')).toEqual({
      currency: 'CZK',
      iban: 'LT123250000000000001',
      start: 100,
      out: 857.5,
      in: 1262.5,
      end: 505,
    });
  });
});

describe('sectionAt', () => {
  it('puts a row in the last section heading above it, on its page or before', () => {
    const at = sectionAt([line(1, 30, 'EUR Statement'), line(1, 400, 'CZK Statement'), line(2, 30, 'Page 2')]);
    expect(at({ page: 1, y: 200 })).toBe('EUR');
    expect(at({ page: 1, y: 420 })).toBe('CZK');
    expect(at({ page: 2, y: 100 })).toBe('CZK');
    expect(at({ page: 1, y: 10 })).toBeUndefined();
  });
});

describe('withFees', () => {
  const block = (fee: string) => [[line(2, 209, 'x'), line(2, 221, fee)]];

  it('books money in printed net of its fee gross, with the fee as a row of its own', () => {
    const [gross, fee] = withFees([row({ credit: 1250, balance: 1350 })], block('Fee: 12.50 CZK 1,262.50 CZK'));
    expect(gross).toMatchObject({ credit: 1262.5, balance: undefined });
    expect(fee).toMatchObject({ debit: 12.5, credit: undefined, balance: 1350, description: 'Fee: Exchanged from EUR' });
  });

  it('leaves money in already printed gross, money out and a row without a fee as they are', () => {
    const gross = row({ credit: 1262.5, balance: 1350 });
    expect(withFees([gross], block('Fee: 12.50 CZK 1,250.00 CZK'))).toEqual([gross]);
    const out = row({ debit: 580, balance: 505 });
    expect(withFees([out], block('Fee: 20.00 CZK 600.00 CZK'))).toEqual([out]);
    const plain = row({ credit: 200 });
    expect(withFees([plain], [[line(1, 209, 'x')]])).toEqual([plain]);
  });
});

describe('withSummary', () => {
  const account = (accountNumber: string, currency: string): ParsedStatement => ({
    metadata: { accountNumber, currency, dateFrom: new Date(), dateTo: new Date() },
    transactions: [
      { transactionDate: new Date(), counterpartyName: 'ACME', paymentPurpose: 'ACME', credit: 200, currency },
      { transactionDate: new Date(), counterpartyName: 'ACME', paymentPurpose: 'ACME', debit: 62.49, currency },
    ],
    checks: [{ code: 'printed_balances', passed: false }],
  });
  const sections = revolutSections(['EUR Statement', SUMMARY_EUR]);

  it("takes the section's balances, holds the rows to its money in and out, and keeps its IBAN alone", () => {
    const read = withSummary(account('LT123250000000000001#EUR', 'EUR'), sections);
    expect(read.metadata).toMatchObject({ accountNumber: 'LT123250000000000001', balanceStart: 10, balanceEnd: 147.51 });
    expect(read.checks).toEqual([{ code: 'printed_totals', passed: true }]);
    expect(withSummary(account('#EUR', 'EUR'), sections).metadata.accountNumber).toBe('');
  });

  it('fails the totals when the rows miss money the summary counts', () => {
    const read = withSummary({ ...account('#EUR', 'EUR'), transactions: [] }, sections);
    expect(read.checks?.find(check => check.code === 'printed_totals')?.passed).toBe(false);
  });
});

describe('isRevolutStatement', () => {
  it("knows Revolut Bank's statement by a page headed by its currency section", () => {
    expect(isRevolutStatement('EUR Statement\nGenerated on the 1 Apr 2026\nRevolut Bank UAB')).toBe(true);
  });

  it("does not take another bank's statement mentioning Revolut Bank in a row", () => {
    const other = 'EUR Statement\nACME Bank plc\nDate Description\n1\n2\n3\n4\nTransfer to Revolut Bank UAB';
    expect(isRevolutStatement(other)).toBe(false);
    expect(isRevolutStatement('EUR Statement Page 1 of 2\nRevolut Bank UAB')).toBe(false);
  });
});
