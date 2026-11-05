import { neutralizeSpreadsheetFormulaCell } from '../../../common/utils/spreadsheet-formula.util';
import { CustomTableColumn } from '../../../entities/custom-table-column.entity';
import { getRowDataValue, type RowDataRecord } from './row-data';
import { columnSourceConfig } from './source-columns';

export type ConvertedTransactionInput = {
  rowNumber: number;
  transactionDate: Date;
  merchant: string;
  purpose: string;
  amount: number;
  currency: string;
  article: string | null;
};

export type ConversionMapping = Partial<Record<ConversionField, string>>;

export type ConversionField = 'date' | 'amount' | 'merchant' | 'purpose' | 'article' | 'currency';

export function normalizeColumnText(value: string | null | undefined): string {
  return (value || '').trim().toLowerCase();
}

export function getColumnSearchText(column: CustomTableColumn): string {
  const source = columnSourceConfig(column.config);
  return [column.title, column.key, source?.field, source?.name, source?.kind]
    .map(value => normalizeColumnText(value))
    .filter(Boolean)
    .join(' ');
}

export function findConversionColumnKey(
  columns: CustomTableColumn[],
  tokens: string[],
): string | undefined {
  const normalizedTokens = tokens.map(token => token.toLowerCase());
  const exact = columns.find(column => {
    const source = columnSourceConfig(column.config);
    const sourceField = normalizeColumnText(source?.field);
    return sourceField && normalizedTokens.includes(sourceField);
  });
  if (exact) {
    return exact.key;
  }
  return columns.find(column => {
    const haystack = getColumnSearchText(column);
    return normalizedTokens.some(token => haystack.includes(token));
  })?.key;
}

export function buildConversionMapping(columns: CustomTableColumn[]): ConversionMapping {
  return {
    date: findConversionColumnKey(columns, ['date', 'дата']),
    amount: findConversionColumnKey(columns, ['amount', 'сумма', 'debit', 'расход']),
    merchant: findConversionColumnKey(columns, [
      'merchant',
      'counterparty',
      'payee',
      'vendor',
      'client',
      'контрагент',
      'поставщик',
      'клиент',
      'магазин',
    ]),
    purpose: findConversionColumnKey(columns, ['purpose', 'description', 'назначение', 'описание']),
    article: findConversionColumnKey(columns, ['article', 'статья']),
    currency: findConversionColumnKey(columns, ['currency', 'валюта']),
  };
}

export function readScalarString(data: RowDataRecord, key?: string): string {
  if (!key) {
    return '';
  }
  const value = getRowDataValue(data, key);
  if (value === null || value === undefined || Array.isArray(value) || typeof value === 'object') {
    return '';
  }
  return String(value).trim();
}

export function parseConversionDate(value: unknown): Date | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (value === null || value === undefined) {
    return null;
  }
  const raw = String(value).trim();
  if (!raw) {
    return null;
  }
  const dateOnly = raw.match(/^\d{4}-\d{2}-\d{2}/)?.[0];
  const parsed = new Date(dateOnly ? `${dateOnly}T00:00:00.000Z` : raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function parsePositiveAmount(value: unknown): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const normalized =
    typeof value === 'number'
      ? value
      : Number(
          String(value)
            .trim()
            .replace(/\s+/g, '')
            .replace(',', '.')
            .replace(/[^\d.-]/g, ''),
        );
  if (!Number.isFinite(normalized) || normalized <= 0) {
    return null;
  }
  return Number(normalized.toFixed(2));
}

export function toDateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export function escapeCsvValue(value: string): string {
  // Neutralize before quoting: quoting keeps the CSV well-formed but does not
  // stop Excel or Sheets from evaluating a cell that begins with = + - @, and
  // this content originates from imported statements and receipts.
  const safe = neutralizeSpreadsheetFormulaCell(value) as string;
  if (safe.includes(',') || safe.includes('"') || safe.includes('\n')) {
    return `"${safe.replaceAll('"', '""')}"`;
  }
  return safe;
}

export function buildConvertedCsv(rows: ConvertedTransactionInput[]): Buffer {
  const lines = [
    'date,merchant,purpose,article,amount,currency',
    ...rows.map(row =>
      [
        toDateOnly(row.transactionDate),
        escapeCsvValue(row.merchant),
        escapeCsvValue(row.purpose),
        escapeCsvValue(row.article || ''),
        row.amount.toFixed(2),
        row.currency,
      ].join(','),
    ),
  ];
  return Buffer.from(lines.join('\n'), 'utf8');
}
