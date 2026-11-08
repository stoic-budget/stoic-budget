import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { QifParser } from '@/modules/parsing/parsers/qif.parser';
import { parseQif, readQifCategory } from '@/modules/parsing/parsers/qif-format.util';

const qif = (...lines: string[]) => lines.join('\n');

describe('QIF categories (L)', () => {
  it('reads a category and its levels, without the class', () => {
    expect(readQifCategory('Food:Groceries')).toEqual({ categoryName: 'Food:Groceries' });
    expect(readQifCategory(' Food : Groceries /Holiday')).toEqual({ categoryName: 'Food:Groceries' });
  });

  it('reads [Account] as a transfer, not a category', () => {
    expect(readQifCategory('[Rainy Day Savings]')).toEqual({ transferAccount: 'Rainy Day Savings' });
    expect(readQifCategory('[Rainy Day Savings]/Holiday')).toEqual({
      transferAccount: 'Rainy Day Savings',
    });
  });

  it('reads nothing from an empty value or the split placeholder', () => {
    expect(readQifCategory(undefined)).toEqual({});
    expect(readQifCategory('--Split--')).toEqual({});
    expect(readQifCategory('[]')).toEqual({});
  });

  it('puts the category and the transfer on the parsed rows', () => {
    const parsed = parseQif(
      qif(
        '!Type:Bank',
        'D09/03/2026',
        'T-42.50',
        'PACME Store',
        'LShopping:Gadgets',
        '^',
        'D09/04/2026',
        'T-100.00',
        'PTransfer',
        'L[Rainy Day Savings]',
        '^',
      ),
    );
    expect(parsed.transactions[0]).toMatchObject({ debit: 42.5, categoryName: 'Shopping:Gadgets' });
    expect(parsed.transactions[0].transferAccount).toBeUndefined();
    expect(parsed.transactions[1]).toMatchObject({
      debit: 100,
      transferAccount: 'Rainy Day Savings',
    });
    expect(parsed.transactions[1].categoryName).toBeUndefined();
  });
});

describe('QIF splits (S/E/$)', () => {
  const split = (total: string, ...parts: string[]) =>
    parseQif(qif('!Type:Bank', 'D09/05/2026', `T${total}`, 'PExample Grocer', ...parts, '^'));

  it('makes each split line a part with its own category, memo and amount', () => {
    const parsed = split(
      '-100.00',
      'L--Split--',
      'SFood:Groceries',
      'EWeekly shop',
      '$-60.00',
      'SHousehold',
      '$-40.00',
    );
    const [row] = parsed.transactions;
    expect(row).toMatchObject({ debit: 100 });
    expect(row.categoryName).toBeUndefined();
    expect(row.splits).toEqual([
      { amount: 60, categoryName: 'Food:Groceries', memo: 'Weekly shop' },
      { amount: 40, categoryName: 'Household' },
    ]);
    expect(parsed.warnings).toBeUndefined();
  });

  it('keeps parts that fall short of the row, with the rest as a part without a category', () => {
    const parsed = split('-100.00', 'SFood', '$-60.00', 'SHousehold', '$-25.00');
    expect(parsed.transactions[0].splits).toEqual([
      { amount: 60, categoryName: 'Food' },
      { amount: 25, categoryName: 'Household' },
      { amount: 15 },
    ]);
    expect(parsed.warnings).toEqual([
      'Row 1 (2026-09-05): its split parts add up to 85.00 of 100.00; the remaining 15.00 is kept as a part without a category',
    ]);
  });

  it('keeps a row whole when its parts add up to more than it', () => {
    const parsed = split('-100.00', 'SFood', '$-80.00', 'SHousehold', '$-40.00');
    expect(parsed.transactions[0].splits).toBeUndefined();
    expect(parsed.transactions[0].debit).toBe(100);
    expect(parsed.warnings?.[0]).toContain('more than the row');
  });

  it('keeps a row whole when its parts go both in and out', () => {
    const parsed = split('800.00', 'SSalary', '$1000.00', 'STaxes', '$-200.00');
    expect(parsed.transactions[0].splits).toBeUndefined();
    expect(parsed.transactions[0].credit).toBe(800);
    expect(parsed.warnings?.[0]).toContain('both in and out');
  });

  it('takes a lone part as the row category instead of a split', () => {
    const parsed = split('-30.00', 'SFood:Dining', '$-30.00');
    expect(parsed.transactions[0].splits).toBeUndefined();
    expect(parsed.transactions[0].categoryName).toBe('Food:Dining');
  });

  it('reads a transfer part and a part without a category line', () => {
    const parsed = split('-50.00', 'S[Rainy Day Savings]', '$-20.00', 'ETip jar', '$-30.00');
    expect(parsed.transactions[0].splits).toEqual([
      { amount: 20, transferAccount: 'Rainy Day Savings' },
      { amount: 30, memo: 'Tip jar' },
    ]);
  });
});

describe('QIF accounts (!Account)', () => {
  const file = qif(
    '!Option:AutoSwitch',
    '!Account',
    'NEveryday Account',
    'TBank',
    '^',
    'NRainy Day Savings',
    'TBank',
    '^',
    '!Clear:AutoSwitch',
    '!Account',
    'NEveryday Account',
    'TBank',
    '^',
    '!Type:Bank',
    'D09/01/2026',
    'T500.00',
    'POpening Balance',
    'L[Everyday Account]',
    '^',
    'D09/02/2026',
    'T-200.00',
    'PTransfer',
    'L[Rainy Day Savings]',
    '^',
    '!Account',
    'NRainy Day Savings',
    'TBank',
    '^',
    '!Type:Bank',
    'D09/02/2026',
    'T200.00',
    'PTransfer',
    'L[Everyday Account]',
    '^',
  );

  it('makes each account with rows a statement of its own, named as in the file', () => {
    const parsed = parseQif(file);
    expect(parsed.metadata.accountNumber).toBe('Everyday Account');
    expect(parsed.transactions).toHaveLength(1);
    expect(parsed.transactions[0]).toMatchObject({ debit: 200, transferAccount: 'Rainy Day Savings' });
    expect(parsed.otherAccounts).toHaveLength(1);
    expect(parsed.otherAccounts?.[0].metadata.accountNumber).toBe('Rainy Day Savings');
    expect(parsed.otherAccounts?.[0].transactions).toEqual([
      expect.objectContaining({ credit: 200, transferAccount: 'Everyday Account' }),
    ]);
  });

  it("reads an account's opening transfer to itself as its opening balance, not a row", () => {
    const parsed = parseQif(file);
    expect(parsed.metadata.balanceStart).toBe(500);
    expect(parsed.transactions.some(row => row.counterpartyName === 'Opening Balance')).toBe(false);
  });

  it('keeps a file without !Account as one statement of an unknown account', () => {
    const parsed = parseQif(qif('!Type:CCard', 'D09/03/2026', 'T-9.99', 'PACME Store', '^'));
    expect(parsed.metadata.accountNumber).toBe('Unknown');
    expect(parsed.otherAccounts).toBeUndefined();
    expect(parsed.transactions).toHaveLength(1);
  });
});

describe('QIF sections that are not transactions', () => {
  it('reads past category, class and memorized lists and options', () => {
    const parsed = parseQif(
      qif(
        '!Option:MDY',
        '!Type:Cat',
        'NFood',
        'E',
        '^',
        '!Type:Class',
        'NHoliday',
        '^',
        '!Type:Memorized',
        'KC',
        'T-12.00',
        'PACME Store',
        '^',
        '!Type:Bank',
        'D09/06/2026',
        'T-5.00',
        'PExample Cafe',
        '^',
      ),
    );
    expect(parsed.transactions).toHaveLength(1);
    expect(parsed.transactions[0]).toMatchObject({ debit: 5, counterpartyName: 'Example Cafe' });
    expect(parsed.warnings).toBeUndefined();
  });

  it('skips investment records and says so', () => {
    const parsed = parseQif(
      qif(
        '!Account',
        'NBrokerage',
        'TInvst',
        '^',
        '!Type:Invst',
        'D09/07/2026',
        'NBuy',
        'YExample Index Fund',
        'I10.00',
        'Q3',
        'T30.00',
        '^',
        '!Account',
        'NEveryday Account',
        'TBank',
        '^',
        '!Type:Bank',
        'D09/07/2026',
        'T-30.00',
        'PExample Broker',
        '^',
      ),
    );
    expect(parsed.metadata.accountNumber).toBe('Everyday Account');
    expect(parsed.transactions).toHaveLength(1);
    expect(parsed.otherAccounts).toBeUndefined();
    expect(parsed.warnings).toEqual([
      '1 investment records (!Type:Invst) were skipped: investment accounts are not imported from QIF',
    ]);
  });

  it('reads a file that starts with a byte-order mark', () => {
    const parsed = parseQif(`﻿${qif('!Type:Bank', 'D09/08/2026', 'T-1.00', 'PACME Store', '^')}`);
    expect(parsed.transactions).toHaveLength(1);
  });
});

describe('QifParser', () => {
  it('reads a Windows-1251 file', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qif-'));
    const file = path.join(dir, 'export.qif');
    const payee = 'Магазин Пример';
    const text = qif('!Type:Bank', 'D09/09/2026', 'T-15.00', `P${payee}`, 'LПродукты', '^');
    // Windows-1251 by hand: А..я are 0xC0..0xFF, ASCII stays as it is.
    const bytes = Buffer.from(
      [...text].map(char => {
        const code = char.charCodeAt(0);
        return code >= 0x410 && code <= 0x44f ? code - 0x410 + 0xc0 : code;
      }),
    );
    fs.writeFileSync(file, bytes);
    try {
      const parsed = await new QifParser().parse(file);
      expect(parsed.transactions[0]).toMatchObject({ counterpartyName: payee, categoryName: 'Продукты' });
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
