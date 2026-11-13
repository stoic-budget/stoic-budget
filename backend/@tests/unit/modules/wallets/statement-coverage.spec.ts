import {
  type CoverageInput,
  computeCoverage,
} from '../../../../src/modules/wallets/statement-coverage';

const WALLET_ID = 'wallet-1';
const TODAY = '2026-05-10';

let created = 0;
const statement = (overrides: Partial<CoverageInput> & { id: string }): CoverageInput => ({
  fileName: `${overrides.id}.pdf`,
  from: null,
  to: null,
  rowsFrom: null,
  rowsTo: null,
  source: 'manual',
  status: 'completed',
  balanceStart: null,
  balanceEnd: null,
  counted: 0,
  pending: 0,
  rowCount: 0,
  fileHash: `hash-${overrides.id}`,
  sourceAccountIndex: null,
  createdAt: new Date(Date.UTC(2026, 0, 1) + ++created * 60_000).toISOString(),
  duplicateRowsOf: [],
  ...overrides,
});

const coverage = (statements: CoverageInput[], today = TODAY) =>
  computeCoverage(WALLET_ID, 'EUR', statements, today);

describe('computeCoverage', () => {
  it('is empty for an account without statements', () => {
    const result = coverage([]);
    expect(result).toMatchObject({
      walletId: WALLET_ID,
      currency: 'EUR',
      firstDay: null,
      lastDay: null,
      periods: [],
      gaps: [],
      sinceLast: null,
      months: [],
      unexplained: 0,
    });
  });

  it('finds the uncovered days between statements, to the day, and the days since the last one', () => {
    const january = statement({ id: 'jan', from: '2026-01-01', to: '2026-01-31' });
    const march = statement({ id: 'mar', from: '2026-03-03', to: '2026-04-17' });
    const result = coverage([march, january]);

    expect(result.periods.map(period => period.statementId)).toEqual(['jan', 'mar']);
    expect(result.firstDay).toBe('2026-01-01');
    expect(result.lastDay).toBe('2026-04-17');
    expect(result.gaps).toEqual([{ from: '2026-02-01', to: '2026-03-02', days: 30 }]);
    expect(result.sinceLast).toEqual({ from: '2026-04-18', to: TODAY, days: 23 });
  });

  it('has no gap between back-to-back statements and nothing since the last when it reaches today', () => {
    const result = coverage(
      [
        statement({ id: 'a', from: '2026-04-01', to: '2026-04-30' }),
        statement({ id: 'b', from: '2026-05-01', to: TODAY }),
      ],
      TODAY,
    );
    expect(result.gaps).toEqual([]);
    expect(result.sinceLast).toBeNull();
    expect(result.overlaps).toEqual([]);
  });

  it('lists overlapping days with both statements', () => {
    const result = coverage([
      statement({ id: 'a', from: '2026-01-01', to: '2026-01-31' }),
      statement({ id: 'b', from: '2026-01-25', to: '2026-02-28' }),
    ]);
    expect(result.overlaps).toEqual([
      { from: '2026-01-25', to: '2026-01-31', days: 7, statementIds: ['a', 'b'] },
    ]);
    expect(result.gaps).toEqual([]);
  });

  it('takes a second copy of an earlier statement out of every check, saying why', () => {
    const original = statement({ id: 'orig', from: '2026-01-01', to: '2026-01-31', rowCount: 3 });
    const sameFile = statement({
      id: 'again',
      from: '2026-01-01',
      to: '2026-01-31',
      fileHash: original.fileHash,
    });
    const sameRows = statement({
      id: 'copy',
      from: '2026-01-02',
      to: '2026-01-30',
      rowCount: 3,
      duplicateRowsOf: [{ statementId: 'orig', count: 3 }],
    });
    const sameRange = statement({ id: 'export', from: '2026-01-01', to: '2026-01-31' });
    const result = coverage([original, sameFile, sameRows, sameRange]);

    const byId = new Map(result.periods.map(period => [period.statementId, period.duplicateOf]));
    expect(byId.get('orig')).toBeNull();
    expect(byId.get('again')).toEqual({ statementId: 'orig', kind: 'same_file' });
    expect(byId.get('copy')).toEqual({ statementId: 'orig', kind: 'same_rows' });
    expect(byId.get('export')).toEqual({ statementId: 'orig', kind: 'same_range' });
    // Copies are not overlaps of the original.
    expect(result.overlaps).toEqual([]);
  });

  it('does not take a wider statement for a copy, even when every row of it repeats an earlier one', () => {
    // A January–February statement of an account quiet in February: its rows are all January's.
    const result = coverage([
      statement({ id: 'jan', from: '2026-01-01', to: '2026-01-31', rowCount: 3 }),
      statement({
        id: 'janfeb',
        from: '2026-01-01',
        to: '2026-02-28',
        rowCount: 3,
        duplicateRowsOf: [{ statementId: 'jan', count: 3 }],
      }),
      statement({ id: 'mar', from: '2026-03-01', to: '2026-03-31' }),
    ]);
    expect(result.periods.find(period => period.statementId === 'janfeb')?.duplicateOf).toBeNull();
    expect(result.gaps).toEqual([]);
  });

  it('does not take the same dates for a copy when the printed balances differ', () => {
    const result = coverage([
      statement({ id: 'a', from: '2026-01-01', to: '2026-01-31', balanceStart: 0, balanceEnd: 10, counted: 10 }),
      statement({ id: 'b', from: '2026-01-01', to: '2026-01-31', balanceStart: 500, balanceEnd: 600 }),
      statement({ id: 'c', from: '2026-01-01', to: '2026-01-31', balanceStart: 0, balanceEnd: 10 }),
      statement({ id: 'd', from: '2026-01-01', to: '2026-01-31' }),
    ]);
    const byId = new Map(result.periods.map(period => [period.statementId, period.duplicateOf]));
    expect(byId.get('b')).toBeNull();
    // Same balances, or one side printing none: the same month twice.
    expect(byId.get('c')).toEqual({ statementId: 'a', kind: 'same_range' });
    expect(byId.get('d')).toEqual({ statementId: 'a', kind: 'same_range' });
    // b stays in the checks, so its own problem shows.
    expect(result.movementMismatches.map(item => item.statementId)).toEqual(['b']);
  });

  it('points a copy of a copy at the original', () => {
    const original = statement({ id: 'orig', from: '2026-01-01', to: '2026-01-31', rowCount: 3 });
    // The same file again, then a sheet whose rows dedupe matched against that second copy.
    const again = statement({ id: 'again', from: '2026-01-01', to: '2026-01-31', fileHash: original.fileHash, rowCount: 3 });
    const sheet = statement({
      id: 'sheet',
      from: '2026-01-05',
      to: '2026-01-20',
      rowCount: 2,
      duplicateRowsOf: [{ statementId: 'again', count: 2 }],
    });
    const result = coverage([original, again, sheet]);
    const byId = new Map(result.periods.map(period => [period.statementId, period.duplicateOf]));
    expect(byId.get('again')).toEqual({ statementId: 'orig', kind: 'same_file' });
    expect(byId.get('sheet')).toEqual({ statementId: 'orig', kind: 'same_rows' });
  });

  it('does not take a statement for a copy when only some of its rows are copies', () => {
    const result = coverage([
      statement({ id: 'orig', from: '2026-01-01', to: '2026-01-31', rowCount: 3 }),
      statement({
        id: 'wider',
        from: '2026-01-15',
        to: '2026-02-28',
        rowCount: 5,
        duplicateRowsOf: [{ statementId: 'orig', count: 2 }],
      }),
    ]);
    expect(result.periods[1].duplicateOf).toBeNull();
    expect(result.overlaps).toHaveLength(1);
  });

  it('keeps two bank feed pulls of one day apart and does not call their re-asked days overlaps', () => {
    const result = coverage([
      statement({ id: 'pull-1', source: 'bank_sync', from: '2026-04-01', to: '2026-04-01' }),
      statement({ id: 'pull-2', source: 'bank_sync', from: '2026-04-01', to: '2026-04-01' }),
      statement({ id: 'pull-3', source: 'bank_sync', from: '2026-04-02', to: '2026-04-12' }),
      statement({ id: 'pull-4', source: 'bank_sync', from: '2026-04-05', to: '2026-04-20' }),
    ]);
    expect(result.periods.every(period => period.duplicateOf === null)).toBe(true);
    expect(result.gaps).toEqual([]);
    expect(result.overlaps).toEqual([]);
  });

  it('covers only the days a bank feed pull asked for: a break in the feed is a gap', () => {
    // Each pull's statement carries the days it asked for; nothing was asked in between.
    const result = coverage(
      [
        statement({ id: 'pull-jan', source: 'bank_sync', from: '2026-01-02', to: '2026-01-20' }),
        statement({ id: 'pull-jul', source: 'bank_sync', from: '2026-07-15', to: '2026-10-10' }),
      ],
      '2026-10-10',
    );
    expect(result.gaps).toEqual([{ from: '2026-01-21', to: '2026-07-14', days: 175 }]);
    expect(result.months.find(month => month.month === '2026-03')?.state).toBe('gap');
  });

  it('still finds a gap between a bank feed pull and an imported file', () => {
    const result = coverage([
      statement({ id: 'file', from: '2026-03-01', to: '2026-03-31' }),
      statement({ id: 'pull', source: 'bank_sync', from: '2026-04-09', to: '2026-04-12' }),
    ]);
    expect(result.gaps).toEqual([{ from: '2026-04-01', to: '2026-04-08', days: 8 }]);
  });

  it('checks each closing balance against the next opening balance, with the difference', () => {
    const result = coverage([
      statement({ id: 'jan', from: '2026-01-01', to: '2026-01-31', balanceStart: 100, balanceEnd: 250, counted: 150 }),
      statement({ id: 'feb', from: '2026-02-01', to: '2026-02-28', balanceStart: 250, balanceEnd: 300, counted: 50 }),
      statement({ id: 'apr', from: '2026-04-01', to: '2026-04-30', balanceStart: 280.4, balanceEnd: 280.4 }),
    ]);
    expect(result.chainBreaks).toEqual([
      {
        fromStatementId: 'feb',
        toStatementId: 'apr',
        date: '2026-04-01',
        closing: 300,
        opening: 280.4,
        difference: -19.6,
        afterGap: true,
      },
    ]);
    expect(result.movementMismatches).toEqual([]);
    expect(result.unexplained).toBe(-19.6);
  });

  it('chains what follows a statement nested in a longer one to the longer one', () => {
    const result = coverage([
      statement({ id: 'q1', from: '2026-01-01', to: '2026-03-31', balanceStart: 300, balanceEnd: 300 }),
      statement({ id: 'feb', from: '2026-02-01', to: '2026-02-28', balanceStart: 300, balanceEnd: 200, counted: -100 }),
      statement({ id: 'apr', from: '2026-04-01', to: '2026-04-30', balanceStart: 300, balanceEnd: 300 }),
    ]);
    expect(result.chainBreaks).toEqual([]);
    expect(result.unexplained).toBe(0);
  });

  it('does not chain overlapping statements or ones missing a balance', () => {
    const result = coverage([
      statement({ id: 'a', from: '2026-01-01', to: '2026-01-31', balanceEnd: 100 }),
      statement({ id: 'b', from: '2026-01-20', to: '2026-02-28', balanceStart: 40, balanceEnd: 90 }),
      statement({ id: 'c', from: '2026-03-01', to: '2026-03-31', balanceStart: null }),
    ]);
    expect(result.chainBreaks).toEqual([]);
  });

  it('checks each statement opening plus its rows against its closing, rows in Review included', () => {
    const result = coverage([
      // Every row confirmed: adds up.
      statement({ id: 'ok', from: '2026-01-01', to: '2026-01-31', balanceStart: 100, balanceEnd: 80, counted: -20 }),
      // Half its rows still in Review: they explain their share.
      statement({ id: 'review', from: '2026-02-01', to: '2026-02-28', balanceStart: 80, balanceEnd: 50, counted: -10, pending: -20 }),
      // A row missing: 12.34 nobody explains.
      statement({ id: 'short', from: '2026-03-01', to: '2026-03-31', balanceStart: 50, balanceEnd: 37.66, counted: 0 }),
    ]);
    expect(result.movementMismatches).toEqual([
      {
        statementId: 'short',
        from: '2026-03-01',
        to: '2026-03-31',
        opening: 50,
        closing: 37.66,
        counted: 0,
        pending: 0,
        difference: -12.34,
      },
    ]);
    expect(result.chainBreaks).toEqual([]);
    expect(result.unexplained).toBe(-12.34);
  });

  it('adds every chain break and movement difference into the unexplained figure', () => {
    const result = coverage([
      statement({ id: 'a', from: '2026-01-01', to: '2026-01-31', balanceStart: 0, balanceEnd: 100, counted: 90 }),
      statement({ id: 'b', from: '2026-02-01', to: '2026-02-28', balanceStart: 105, balanceEnd: 105 }),
    ]);
    expect(result.movementMismatches.map(item => item.difference)).toEqual([10]);
    expect(result.chainBreaks.map(item => item.difference)).toEqual([5]);
    expect(result.unexplained).toBe(15);
  });

  it('leaves a copy out of the movement check: its rows are flagged, so they never count', () => {
    const result = coverage([
      statement({ id: 'orig', from: '2026-01-01', to: '2026-01-31', balanceStart: 0, balanceEnd: 50, counted: 50, rowCount: 2 }),
      statement({ id: 'copy', from: '2026-01-01', to: '2026-01-31', balanceStart: 0, balanceEnd: 50, counted: 0, rowCount: 2, duplicateRowsOf: [{ statementId: 'orig', count: 2 }] }),
    ]);
    expect(result.movementMismatches).toEqual([]);
    expect(result.unexplained).toBe(0);
  });

  it('falls back to the first and last row dates for a statement printing no period, marked as inferred', () => {
    const result = coverage([
      statement({ id: 'printed', from: '2026-01-01', to: '2026-01-31' }),
      statement({ id: 'csv', rowsFrom: '2026-02-03', rowsTo: '2026-02-20' }),
      statement({ id: 'empty' }),
    ]);
    expect(result.periods.map(({ statementId, from, to, inferred }) => ({ statementId, from, to, inferred }))).toEqual([
      { statementId: 'printed', from: '2026-01-01', to: '2026-01-31', inferred: false },
      { statementId: 'csv', from: '2026-02-03', to: '2026-02-20', inferred: true },
    ]);
    expect(result.gaps).toEqual([{ from: '2026-02-01', to: '2026-02-02', days: 2 }]);
  });

  it('marks each month covered, partial, gap or overlap, counting the current month up to today', () => {
    const result = coverage(
      [
        statement({ id: 'jan', from: '2026-01-01', to: '2026-01-31' }),
        statement({ id: 'mar', from: '2026-03-10', to: '2026-04-05' }),
        statement({ id: 'apr', from: '2026-04-01', to: '2026-04-30' }),
      ],
      '2026-05-10',
    );
    expect(result.months).toEqual([
      { month: '2026-01', state: 'covered', coveredDays: 31, days: 31 },
      { month: '2026-02', state: 'gap', coveredDays: 0, days: 28 },
      { month: '2026-03', state: 'partial', coveredDays: 22, days: 31 },
      { month: '2026-04', state: 'overlap', coveredDays: 30, days: 30 },
      { month: '2026-05', state: 'gap', coveredDays: 0, days: 10 },
    ]);
  });

  it('treats each account of a multi-account file by itself: siblings are statements of their own', () => {
    // The service reads only this account's statements; a sibling of the same
    // file in this account would share the hash but not the account index.
    const result = coverage([
      statement({ id: 'first', from: '2026-01-01', to: '2026-01-31', fileHash: 'file', sourceAccountIndex: null }),
      statement({ id: 'second', from: '2026-02-01', to: '2026-02-28', fileHash: 'file', sourceAccountIndex: 1 }),
    ]);
    expect(result.periods.every(period => period.duplicateOf === null)).toBe(true);
  });
});
