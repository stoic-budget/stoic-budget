import { findHeaderRow } from '@/app/(main)/custom-tables/[id]/utils/importRows';
import type { ImportRowResult, ImportSuggestion, ImportTarget } from './import-wizard-api';
import { TARGET_FIELDS } from './import-wizard-api';

export const IMPORT_ROWS_MAX = 5000;
const SAMPLE_ROWS = 5;

export interface PreparedSheet {
  headers: string[];
  rows: string[][];
  /** First data rows, for the suggestion request and the example column. */
  samples: string[][];
  /** Data rows in the file, before the import's cap (more than `rows` when cut). */
  totalRows: number;
}

const isEmptyRow = (row: string[]): boolean => row.every(cell => String(cell ?? '').trim() === '');

/**
 * Splits a sheet into headers and data rows. Report titles above the header
 * are dropped, a sheet without a header row gets positional names.
 */
export function prepareSheet(rawRows: string[][]): PreparedSheet {
  const rows = rawRows.map(row => row.map(cell => String(cell ?? '')));
  const headerIndex = findHeaderRow(rows);
  const width = Math.max(0, ...rows.map(row => row.length));
  const headers =
    headerIndex >= 0
      ? Array.from({ length: width }, (_, i) => String(rows[headerIndex][i] ?? '').trim())
      : Array.from({ length: width }, (_, i) => `#${i + 1}`);
  const filled = rows.slice(headerIndex + 1).filter(row => !isEmptyRow(row));
  const dataRows = filled
    .slice(0, IMPORT_ROWS_MAX)
    .map(row => Array.from({ length: width }, (_, i) => row[i] ?? ''));
  return {
    headers,
    rows: dataRows,
    samples: dataRows.slice(0, SAMPLE_ROWS),
    totalRows: filled.length,
  };
}

export const mappingFromSuggestion = (
  suggestion: ImportSuggestion | null,
): Record<string, number> => {
  const mapping: Record<string, number> = {};
  for (const column of suggestion?.columns ?? []) {
    if (column.role && !(column.role in mapping)) {
      mapping[column.role] = column.index;
    }
  }
  return mapping;
};

/** Column index → role, the shape the mapping table renders. */
export const roleByColumn = (mapping: Record<string, number>): Map<number, string> =>
  new Map(Object.entries(mapping).map(([role, index]) => [index, role]));

export const missingRequiredFields = (
  target: ImportTarget,
  mapping: Record<string, number>,
): string[] =>
  TARGET_FIELDS[target]
    .filter(field => field.required && !Number.isInteger(mapping[field.key]))
    .map(field => field.key);

/** Assigns `role` to `index`, releasing whichever column held that role before. */
export function assignRole(
  mapping: Record<string, number>,
  index: number,
  role: string | null,
): Record<string, number> {
  const next: Record<string, number> = {};
  for (const [key, value] of Object.entries(mapping)) {
    if (value !== index && key !== role) {
      next[key] = value;
    }
  }
  if (role) {
    next[role] = index;
  }
  return next;
}

export const firstExample = (samples: string[][], index: number): string =>
  samples.map(row => String(row[index] ?? '').trim()).find(Boolean) ?? '';

export const problemRows = (rows: ImportRowResult[]): ImportRowResult[] =>
  rows.filter(row => row.status === 'skipped' || row.status === 'error');

/** Filters that open exactly the imported records as a source-bound table. */
export const openAsTableFilters = (
  target: ImportTarget,
  createdIds: string[],
): Record<string, unknown> =>
  target === 'transactions' ? { statementIds: createdIds.slice(0, 10) } : { ids: createdIds };

export const fillTemplate = (template: string, vars: Record<string, string | number>): string =>
  Object.entries(vars).reduce(
    (acc, [key, value]) => acc.split(`{{${key}}}`).join(String(value)),
    template,
  );

/**
 * How many rows the import takes, saying so when the file had more than the
 * cap (#636): the rest would otherwise be left out without a word.
 */
export const rowsLabel = (
  sheet: Pick<PreparedSheet, 'rows' | 'totalRows'>,
  texts: { rowsTotal: { value: string }; rowsCut: { value: string } },
): string =>
  fillTemplate(sheet.totalRows > sheet.rows.length ? texts.rowsCut.value : texts.rowsTotal.value, {
    count: sheet.rows.length,
    total: sheet.totalRows,
  });
