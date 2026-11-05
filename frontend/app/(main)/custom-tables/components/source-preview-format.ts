import { formatStoredDateWithOptions } from '@/app/lib/user-format-store';

/** Values shown through the translated option labels rather than as stored. */
export const ENUM_FIELDS = new Set(['status', 'frequency', 'direction', 'periodType']);

/** Stored cell values as the rest of the app shows them: "Sep 1, 2024", "−€650.00". */
export function formatPreviewCell(
  value: string | number | boolean | null | undefined,
  column: { field: string; type: string },
  row: Record<string, string | number | boolean | null>,
  locale: string,
  optionLabels: Record<string, string>,
): string {
  if (value === null || value === undefined || value === '') {
    return '';
  }
  if (column.type === 'date' && typeof value === 'string') {
    return formatStoredDateWithOptions(
      value,
      { day: 'numeric', month: 'short', year: 'numeric' },
      locale,
    );
  }
  if (typeof value === 'number' && (column.type === 'currency' || column.type === 'number')) {
    const currency = typeof row.currency === 'string' ? row.currency : '';
    const money = column.type === 'currency';
    const text = new Intl.NumberFormat(locale, {
      ...(money && /^[A-Za-z]{3}$/.test(currency)
        ? { style: 'currency', currency: currency.toUpperCase() }
        : {}),
      minimumFractionDigits: money ? 2 : 0,
      maximumFractionDigits: 2,
    }).format(value);
    return text.replace('-', '−');
  }
  if (typeof value === 'string' && ENUM_FIELDS.has(column.field)) {
    return optionLabels[value] ?? value;
  }
  return String(value);
}
