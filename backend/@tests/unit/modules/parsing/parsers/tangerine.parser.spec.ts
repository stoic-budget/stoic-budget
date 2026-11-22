import type { PdfTextRow } from '@/common/utils/pdf-parser.util';
import { BankName, FileType } from '@/entities/statement.entity';
import type { LayoutTransaction } from '@/modules/parsing/helpers/pdf-layout-table.helper';
import type { ParsedTransaction } from '@/modules/parsing/interfaces/parsed-statement.interface';
import {
  TangerineParser,
  isTangerineStatement,
  tangerineAccounts,
  tangerineEntry,
} from '@/modules/parsing/parsers/tangerine.parser';

const STATEMENT = ['Statement www.tangerine.ca', 'Your Orange Key is 10000000S1', 'Account(s) at a Glance'].join('\n');

const line = (y: number, text: string): PdfTextRow => ({ page: 1, y, text, items: [] });
const read = (y: number, amount: number, balance: number): LayoutTransaction => ({
  date: { day: 11, month: 10, year: 2021 },
  dateText: '11 Oct 2021',
  description: 'Row',
  firstLine: 'Row',
  counterparty: '',
  amount,
  balance,
  at: { page: 1, y },
});

const row = (paymentPurpose: string, amount: { debit?: number; credit?: number }): ParsedTransaction => ({
  transactionDate: new Date(2021, 9, 18),
  paymentPurpose,
  counterpartyName: paymentPurpose,
  currency: 'CAD',
  ...amount,
});

describe('TangerineParser', () => {
  it('knows its statement by its web address and Orange Key', () => {
    expect(isTangerineStatement(STATEMENT)).toBe(true);
    expect(isTangerineStatement('Transfer to www.tangerine.ca')).toBe(false);
  });

  it('parses its files under its own bank or OTHER, and PDFs only', async () => {
    const parser = new TangerineParser();
    const claims = (bank: BankName, type = FileType.PDF) =>
      parser.canParse(bank, type, 'x.pdf', STATEMENT);
    await expect(claims(BankName.TANGERINE)).resolves.toBe(true);
    await expect(claims(BankName.OTHER)).resolves.toBe(true);
    await expect(claims(BankName.SCOTIABANK)).resolves.toBe(false);
    await expect(claims(BankName.TANGERINE, FileType.CSV)).resolves.toBe(false);
  });

  it('files each account\'s rows under it, signed by the running balance', () => {
    const rows = [
      line(100, 'The Details - Tangerine Savings Account - 1000000001'),
      line(110, '01 Oct 2021 Opening Balance 0.00 664.54'),
      line(200, 'The Details - Tangerine TFSA - 10000 00002'),
      line(210, '01 Oct 2021 Opening Balance 0.00 10,025.57'),
    ];
    const accounts = tangerineAccounts(rows, [read(120, 500, 164.54), read(130, 1000, 1164.54), read(220, 9.79, 10035.36)]);
    expect(accounts.map(account => [account.account?.accountNumber, account.debit, account.credit])).toEqual([
      ['1000000001', 500, undefined],
      ['1000000001', undefined, 1000],
      ['1000000002', undefined, 9.79],
    ]);
  });

  it('reads an e-Transfer\'s sender', () => {
    expect(tangerineEntry(row('INTERAC e-Transfer From: Member One', { credit: 1000 }))).toMatchObject({
      counterpartyName: 'Member One',
      paymentType: 'bank_transfer_in',
    });
  });
});
