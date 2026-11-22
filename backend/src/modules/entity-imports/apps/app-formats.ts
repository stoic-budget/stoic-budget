import type { AppFileKind, AppName } from './app-model';

/**
 * The header rows of the exports this importer reads, each confirmed against
 * the app's documentation or source code (see the parsers). A file is
 * recognised only when every listed column is present; extra columns are fine.
 */
export type AppFormat = 'ynab-register' | 'ynab-plan' | 'actual' | 'actual-basic' | 'firefly';

const SIGNATURES: Array<{ format: AppFormat; app: AppName; kind: AppFileKind; columns: string[] }> =
  [
    {
      format: 'ynab-register',
      app: 'ynab',
      kind: 'register',
      columns: [
        'account',
        'date',
        'payee',
        'category group',
        'category',
        'memo',
        'outflow',
        'inflow',
      ],
    },
    {
      format: 'ynab-plan',
      app: 'ynab',
      kind: 'plan',
      columns: ['month', 'category group', 'category', 'assigned', 'activity', 'available'],
    },
    {
      format: 'actual',
      app: 'actual',
      kind: 'register',
      columns: ['account', 'date', 'payee', 'notes', 'category_group', 'category', 'amount'],
    },
    {
      format: 'actual-basic',
      app: 'actual',
      kind: 'register',
      columns: ['account', 'date', 'payee', 'notes', 'category', 'amount', 'reconciled'],
    },
    {
      format: 'firefly',
      app: 'firefly',
      kind: 'register',
      columns: [
        'group_id',
        'journal_id',
        'type',
        'currency_code',
        'amount',
        'description',
        'date',
        'source_name',
        'source_type',
        'destination_name',
        'destination_type',
        'category',
      ],
    },
  ];

export interface DetectedFormat {
  format: AppFormat;
  app: AppName;
  kind: AppFileKind;
  /** Column index by lower-cased header name. */
  columns: Map<string, number>;
}

/** The export a header row belongs to, or null when it matches none of them. */
export function detectAppFormat(headers: string[]): DetectedFormat | null {
  const columns = new Map<string, number>();
  headers.forEach((header, index) => {
    const key = header.trim().toLowerCase();
    if (key && !columns.has(key)) {
      columns.set(key, index);
    }
  });
  const match = SIGNATURES.find(signature => signature.columns.every(name => columns.has(name)));
  return match ? { format: match.format, app: match.app, kind: match.kind, columns } : null;
}

/** A cell by column name; '' when the column or the cell is missing. */
export const cellOf = (row: string[], columns: Map<string, number>, name: string): string => {
  const index = columns.get(name);
  return index === undefined ? '' : String(row[index] ?? '').trim();
};
