import { describe, expect, it } from 'vitest';
import {
  assignRole,
  mappingFromSuggestion,
  missingRequiredFields,
  openAsTableFilters,
  IMPORT_ROWS_MAX,
  prepareSheet,
  problemRows,
  rowsLabel,
} from './import-wizard-utils';

describe('rowsLabel', () => {
  const texts = {
    rowsTotal: { value: '{{count}} rows' },
    rowsCut: { value: '{{count}} of {{total}} rows: only the first {{count}} are imported' },
  };

  it('says when the file had more rows than the import takes (#636)', () => {
    const rows = Array.from({ length: IMPORT_ROWS_MAX + 2 }, (_, i) => [`2026-02-10`, `ACME ${i}`, '-5']);
    const sheet = prepareSheet([['Date', 'Merchant', 'Amount'], ...rows]);

    expect(sheet.rows).toHaveLength(IMPORT_ROWS_MAX);
    expect(sheet.totalRows).toBe(IMPORT_ROWS_MAX + 2);
    expect(rowsLabel(sheet, texts)).toBe(
      `${IMPORT_ROWS_MAX} of ${IMPORT_ROWS_MAX + 2} rows: only the first ${IMPORT_ROWS_MAX} are imported`,
    );
    expect(rowsLabel({ rows: [['a']], totalRows: 1 }, texts)).toBe('1 rows');
  });
});

describe('prepareSheet', () => {
  it('drops report titles above the header and empty rows', () => {
    const sheet = prepareSheet([
      ['Bills October', '', ''],
      ['', '', ''],
      ['Vendor', 'Amount', 'Due date'],
      ['Electric', '120', '2026-10-15'],
      ['', '', ''],
      ['Water', '40', '2026-10-20'],
    ]);
    expect(sheet.headers).toEqual(['Vendor', 'Amount', 'Due date']);
    expect(sheet.rows).toEqual([
      ['Electric', '120', '2026-10-15'],
      ['Water', '40', '2026-10-20'],
    ]);
    expect(sheet.samples).toHaveLength(2);
  });

  it('names columns positionally when there is no header', () => {
    const sheet = prepareSheet([
      ['2026-09-01', 'Coffee', '4.5'],
      ['2026-09-02', 'Lunch', '12'],
    ]);
    expect(sheet.headers).toEqual(['#1', '#2', '#3']);
    expect(sheet.rows).toHaveLength(2);
  });

  it('pads ragged rows to the header width', () => {
    const sheet = prepareSheet([
      ['A', 'B', 'C'],
      ['1', '2'],
    ]);
    expect(sheet.rows).toEqual([['1', '2', '']]);
  });
});

describe('mapping helpers', () => {
  it('builds a role → index mapping from a suggestion, first role wins', () => {
    expect(
      mappingFromSuggestion({
        target: 'payables',
        confidence: 0.8,
        alternatives: [],
        columns: [
          { index: 0, role: 'vendor' },
          { index: 1, role: 'amount' },
          { index: 2, role: 'amount' },
          { index: 3, role: null },
        ],
      }),
    ).toEqual({ vendor: 0, amount: 1 });
  });

  it('reports required fields that are not mapped', () => {
    expect(missingRequiredFields('invoices', { client: 0 })).toEqual(['issueDate', 'amount']);
    expect(missingRequiredFields('budgets', { category: 0, limit: 1 })).toEqual([]);
  });

  it('assignRole moves a role between columns and clears with null', () => {
    const mapping = { vendor: 0, amount: 1 };
    expect(assignRole(mapping, 2, 'amount')).toEqual({ vendor: 0, amount: 2 });
    expect(assignRole(mapping, 0, null)).toEqual({ amount: 1 });
    expect(assignRole(mapping, 0, 'dueDate')).toEqual({ amount: 1, dueDate: 0 });
  });

  it('opens transactions by statement and everything else by id', () => {
    expect(openAsTableFilters('transactions', ['s1'])).toEqual({ statementIds: ['s1'] });
    expect(openAsTableFilters('payables', ['p1', 'p2'])).toEqual({ ids: ['p1', 'p2'] });
  });

  it('lists only skipped and error rows as problems', () => {
    expect(
      problemRows([
        { index: 0, status: 'created' },
        { index: 1, status: 'skipped', reason: 'duplicate' },
        { index: 2, status: 'error', reason: 'date' },
      ]).map(row => row.index),
    ).toEqual([1, 2]);
  });
});
