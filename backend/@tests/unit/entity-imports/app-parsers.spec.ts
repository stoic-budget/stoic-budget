import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import {
  detectDecimalMark,
  parseAppAmount,
  readDateColumn,
} from '../../../src/modules/entity-imports/apps/app-amounts';
import {
  decodeExport,
  detectDelimiter,
  readExportTable,
  splitDelimited,
} from '../../../src/modules/entity-imports/apps/app-file-text';
import { detectAppFormat } from '../../../src/modules/entity-imports/apps/app-formats';
import { parseAppFile } from '../../../src/modules/entity-imports/apps/app-parse';
import type { WalletType } from '../../../src/entities/wallet.entity';

const FIXTURES = path.join(__dirname, '../../fixtures/app-exports');
const fixture = (name: string) => ({
  fileName: name,
  buffer: new Uint8Array(readFileSync(path.join(FIXTURES, name))),
});
const textFile = (fileName: string, text: string) => ({
  fileName,
  buffer: new TextEncoder().encode(text),
});

describe('app export text', () => {
  it('drops a UTF-8 BOM and reads UTF-16 by its BOM', () => {
    expect(decodeExport(new Uint8Array([0xef, 0xbb, 0xbf, 0x41]))).toBe('A');
    const utf16 = new Uint8Array([0xff, 0xfe, 0x41, 0x00, 0xe9, 0x00]);
    expect(decodeExport(utf16)).toBe('Aé');
  });

  it('falls back to Windows-1252 when the bytes are not UTF-8', () => {
    // "5€" saved by a spreadsheet on Windows: 0x80 is the euro sign there.
    expect(decodeExport(new Uint8Array([0x35, 0x80]))).toBe('5€');
  });

  it('picks the delimiter from the header line and keeps quoted delimiters and newlines', () => {
    expect(detectDelimiter('a\tb\tc\n1,2\t3\t4')).toBe('\t');
    expect(detectDelimiter('"a,b";c;d\n')).toBe(';');
    expect(splitDelimited('a,"b, c","line\none ""x"""\n\n1,2,3\r\n', ',')).toEqual([
      ['a', 'b, c', 'line\none "x"'],
      ['1', '2', '3'],
    ]);
  });

  it('reads amounts in either decimal style, with any currency sign', () => {
    expect(parseAppAmount('$1,234.56', '.')).toBe(1234.56);
    expect(parseAppAmount('1.234,56€', ',')).toBe(1234.56);
    expect(parseAppAmount('-$5.00', '.')).toBe(-5);
    expect(parseAppAmount('(5.00)', '.')).toBe(-5);
    expect(parseAppAmount('−12,30', ',')).toBe(-12.3);
    expect(parseAppAmount('₹1,00,000.00', '.')).toBe(100000);
    expect(parseAppAmount('¥1,234', '.')).toBe(1234);
    expect(parseAppAmount('', '.')).toBeNull();
  });

  it('votes for the decimal mark only on one or two trailing digits', () => {
    expect(detectDecimalMark(['€12,50', '€1.234,56', '€0,00'], '.')).toBe(',');
    expect(detectDecimalMark(['$12.50', '$1,234.56'], ',')).toBe('.');
    // Whole yen say nothing: the fallback stands.
    expect(detectDecimalMark(['¥1,234', '¥500'], '.')).toBe('.');
  });

  it('reads the day/month order from the column, US order when every date is ambiguous', () => {
    expect(readDateColumn(['01/02/2026', '01/15/2026'])).toEqual(['2026-01-02', '2026-01-15']);
    expect(readDateColumn(['01.02.2026', '15.01.2026'])).toEqual(['2026-02-01', '2026-01-15']);
    expect(readDateColumn(['03/04/2026'])).toEqual(['2026-03-04']);
    expect(readDateColumn(['03.04.2026'])).toEqual(['2026-04-03']);
  });
});

describe('app export detection', () => {
  it.each([
    ['ynab-register.csv', 'ynab', 'register'],
    ['ynab-plan.csv', 'ynab', 'plan'],
    ['actual-export.csv', 'actual', 'register'],
    ['firefly-export.csv', 'firefly', 'register'],
  ])('recognises %s by its header row', (name, app, kind) => {
    const table = readExportTable(fixture(name).buffer);
    expect(detectAppFormat(table.headers)).toMatchObject({ app, kind });
  });

  it('recognises nothing in an ordinary bank export', () => {
    expect(detectAppFormat(['Date', 'Payee', 'Amount', 'Balance'])).toBeNull();
  });

  it("reads Actual's basic export with `Group: Name` categories", () => {
    const file = parseAppFile(
      textFile(
        'actual-basic.csv',
        'Account,Date,Payee,Notes,Category,Amount,Cleared,Reconciled\nWallet,2026-02-01,Corner Market,,Usual Expenses: Food,-4.5,true,false\n',
      ),
      new Map(),
    );
    expect(file.app).toBe('actual');
    expect(file.txns[0]).toMatchObject({ group: 'Usual Expenses', category: 'Food', amount: -4.5 });
  });
});

describe('YNAB register', () => {
  const file = parseAppFile(fixture('ynab-register.csv'), new Map());
  const rows = (payee: string) => file.txns.filter(txn => txn.payee === payee);

  it('signs inflow minus outflow and reads month-first dates', () => {
    expect(rows('Employer One')[0]).toMatchObject({ amount: 2500, date: '2026-01-15' });
    expect(rows('ACME Store - Wireless Buds')[0]).toMatchObject({
      amount: -42.5,
      group: 'Everyday',
      category: 'Groceries',
    });
    expect(file.problems).toEqual([]);
  });

  it('keeps income out of the Ready to Assign pseudo-category', () => {
    expect(rows('Employer One')[0]).toMatchObject({ group: null, category: null });
  });

  it('marks opening balances and transfers by their payees', () => {
    expect(rows('Starting Balance').map(txn => [txn.account, txn.opening, txn.amount])).toEqual([
      ['Checking', true, 1000],
      ['Savings', true, 500],
    ]);
    expect(rows('Transfer : Savings')[0]).toMatchObject({ transferTo: 'Savings', category: null });
  });

  it('groups the parts of a split and strips the split marker from the memo', () => {
    const parts = rows('Corner Market');
    expect(parts.map(txn => txn.memo)).toEqual(['Food', 'Soap']);
    expect(parts[0].splitKey).toBeTruthy();
    expect(parts[1].splitKey).toBe(parts[0].splitKey);
    expect(rows('Bean Cafe').every(txn => txn.splitKey === null)).toBe(true);
  });

  it('reads a TSV export of a decimal-comma plan with day-first dates', () => {
    const tsv = [
      ['Account', 'Flag', 'Date', 'Payee', 'Category Group/Category', 'Category Group', 'Category', 'Memo', 'Outflow', 'Inflow', 'Cleared'],
      ['Girokonto', '', '13.01.2026', 'Example Bakery', 'Food: Bread', 'Food', 'Bread', '', '1.234,56€', '0,00€', 'Cleared'],
      ['Girokonto', '', '02.01.2026', 'Employer One', 'Inflow: Ready to Assign', 'Inflow', 'Ready to Assign', '', '0,00€', '2.000,00€', 'Cleared'],
    ]
      .map(row => row.join('\t'))
      .join('\n');
    const parsed = parseAppFile(textFile('ynab.tsv', tsv), new Map());
    expect(parsed.txns.map(txn => [txn.date, txn.amount])).toEqual([
      ['2026-01-13', -1234.56],
      ['2026-01-02', 2000],
    ]);
  });

  it('starts a new split when the next part does not follow on', () => {
    const csv = [
      'Account,Flag,Date,Payee,Category Group/Category,Category Group,Category,Memo,Outflow,Inflow,Cleared',
      'A,,2026-01-05,Shop,G: C,G,C,Split (1/2) x,1.00,0.00,',
      'A,,2026-01-05,Shop,G: C,G,C,Split (2/2) y,2.00,0.00,',
      'A,,2026-01-05,Shop,G: C,G,C,Split (1/2) z,3.00,0.00,',
      'A,,2026-01-05,Shop,G: C,G,C,Split (2/2) w,4.00,0.00,',
    ].join('\n');
    const keys = parseAppFile(textFile('splits.csv', csv), new Map()).txns.map(txn => txn.splitKey);
    expect(keys[0]).toBe(keys[1]);
    expect(keys[2]).toBe(keys[3]);
    expect(keys[2]).not.toBe(keys[0]);
  });
});

describe('YNAB plan', () => {
  const plan = parseAppFile(fixture('ynab-plan.csv'), new Map());

  it('reads month names and amounts, leaving out income and card payments', () => {
    expect(plan.budgets.map(row => [row.month, row.category, row.assigned])).toEqual([
      ['2026-09', 'Groceries', 300],
      ['2026-09', 'Dining Out', 50],
      ['2026-10', 'Groceries', 320],
      ['2026-10', 'Dining Out', 0],
      ['2026-10', 'Rent', 1200],
      ['2026-12', 'Groceries', 999],
    ]);
    expect(plan.budgets.some(row => row.group === 'Credit Card Payments')).toBe(false);
  });
});

describe('Actual export', () => {
  const file = parseAppFile(fixture('actual-export.csv'), new Map());

  it('skips the split parent and groups its children', () => {
    const parts = file.txns.filter(txn => txn.payee === 'Corner Market');
    expect(parts.map(txn => [txn.amount, txn.memo, txn.category])).toEqual([
      [-40, '', 'Food'],
      [-15, 'Light bulbs', 'General'],
    ]);
    expect(parts[0].splitKey).toBe(parts[1].splitKey);
    expect(parts[0].splitKey).not.toBeNull();
    // The parent's zero amount is structure, not an unreadable row.
    expect(file.problems).toEqual([]);
  });

  it('undoes the formula escape and lets payees name accounts', () => {
    expect(file.txns.some(txn => txn.payee === '+Plus Pharmacy')).toBe(true);
    const topUp = file.txns.find(txn => txn.payee === 'Rainy Day');
    expect(topUp).toMatchObject({ amount: -150, payeeMayBeAccount: true });
    expect(file.txns.find(txn => txn.payee === 'Starting Balance')).toMatchObject({
      opening: true,
      payeeMayBeAccount: false,
    });
  });
});

describe('Firefly III export', () => {
  const types = new Map<string, WalletType>();
  const file = parseAppFile(fixture('firefly-export.csv'), types);
  const byDescription = (text: string) => file.txns.find(txn => txn.payee === text);

  it('signs withdrawals out and deposits in, on the asset side', () => {
    expect(byDescription('ACME Store - Wireless Buds')).toMatchObject({
      account: 'Main account',
      amount: -23.9,
      category: 'Groceries',
      date: '2026-03-02',
      currency: 'EUR',
    });
    expect(byDescription('Salary March')).toMatchObject({ account: 'Main account', amount: 3100 });
  });

  it('reads a transfer as one row carrying both legs', () => {
    const transfer = file.txns.find(txn => txn.transferTo);
    expect(transfer).toMatchObject({
      account: 'Main account',
      amount: -400,
      transferTo: 'Savings account',
      arrived: { amount: 400, currency: 'EUR' },
    });
    expect(types.get('Savings account')).toBe('checking');
  });

  it('turns journals of one group into a split and opening balances into openings', () => {
    const parts = file.txns.filter(txn => txn.splitKey);
    expect(parts.map(txn => txn.amount)).toEqual([-30, -12.5]);
    expect(new Set(parts.map(txn => txn.splitKey)).size).toBe(1);
    expect(file.txns.find(txn => txn.opening)).toMatchObject({ account: 'Main account', amount: 1250 });
  });

  it('reports a row of a type it does not book', () => {
    const header = readFileSync(path.join(FIXTURES, 'firefly-export.csv'), 'utf8').split('\n')[0];
    const row =
      '1,20,200,,,,Liability credit,EUR,10.00,,,,,,Owed,2026-03-09T00:00:00+01:00,Credit account,,Liability credit account,Loan One,,Loan,false,,,,,';
    const parsed = parseAppFile(textFile('ff.csv', `${header}\n${row}\n`), new Map());
    expect(parsed.txns).toEqual([]);
    expect(parsed.problems).toEqual([{ fileName: 'ff.csv', row: 2, reason: 'type' }]);
  });
});
