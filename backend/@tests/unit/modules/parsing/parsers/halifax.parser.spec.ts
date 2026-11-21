import { BankName, FileType } from '@/entities/statement.entity';
import type { ParsedStatement } from '@/modules/parsing/interfaces/parsed-statement.interface';
import { HalifaxParser, isHalifaxStatement } from '@/modules/parsing/parsers/halifax.parser';
import { firstDayBalanceLabel } from '@/modules/parsing/parsers/lloyds-group';

const STATEMENT = ['logo, Halifax.', 'Your Transactions', 'Halifax is a division of Bank of Scotland plc.'].join('\n');

describe('HalifaxParser', () => {
  it('knows its statement by its logo text and the transactions heading', () => {
    expect(isHalifaxStatement(STATEMENT)).toBe(true);
    expect(isHalifaxStatement('Transfer to Halifax')).toBe(false);
  });

  it('parses its files under its own bank or OTHER, and PDFs only', async () => {
    const parser = new HalifaxParser();
    const claims = (bank: BankName, type = FileType.PDF) =>
      parser.canParse(bank, type, 'x.pdf', STATEMENT);
    await expect(claims(BankName.HALIFAX)).resolves.toBe(true);
    await expect(claims(BankName.OTHER)).resolves.toBe(true);
    await expect(claims(BankName.BANK_OF_SCOTLAND)).resolves.toBe(false);
    await expect(claims(BankName.HALIFAX, FileType.CSV)).resolves.toBe(false);
  });
});

describe('firstDayBalanceLabel', () => {
  const statement = (expected: number): ParsedStatement => ({
    metadata: {
      accountNumber: '10000001',
      currency: 'GBP',
      dateFrom: new Date(2023, 11, 1),
      dateTo: new Date(2023, 11, 25),
      balanceStart: 21.53,
    },
    transactions: [
      { transactionDate: new Date(2023, 11, 1), paymentPurpose: 'ACME', counterpartyName: 'ACME', credit: 520.87, currency: 'GBP' },
      { transactionDate: new Date(2023, 11, 1), paymentPurpose: 'ACME', counterpartyName: 'ACME', debit: 50, currency: 'GBP' },
    ],
    checks: [{ code: 'printed_balances', passed: false, detail: { side: 'start', expected, actual: 21.53 } }],
  });

  it('drops the check when the printed opening is the balance after a first-day row', () => {
    expect(firstDayBalanceLabel(statement(542.4)).checks).toEqual([]);
    expect(firstDayBalanceLabel(statement(492.4)).checks).toEqual([]);
  });

  it('keeps it for any other figure', () => {
    expect(firstDayBalanceLabel(statement(100)).checks).toHaveLength(1);
  });
});
