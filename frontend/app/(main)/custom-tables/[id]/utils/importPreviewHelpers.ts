import type { PasteColumnMapping, PastePreviewData } from './pasteTypes';
import type { CustomTableColumn } from './types';

export const fill = (template: string, vars: Record<string, string | number>) =>
  Object.entries(vars).reduce((acc, [k, v]) => acc.replace(`{{${k}}}`, String(v)), template);

export const NEW = '__new__';
export const IGNORE = '__ignore__';

const isBlank = (value: unknown): boolean =>
  value === null || value === undefined || String(value).trim() === '';

/**
 * The server rejects the whole batch when a required column of the table is
 * left empty, so say so before the upload: which column, and how many rows.
 */
export function findRequiredProblems(
  columns: CustomTableColumn[],
  preview: PastePreviewData,
): Array<{ title: string; blank: number; unmapped: boolean }> {
  return columns
    .filter(col => col.isRequired)
    .map(col => {
      const mapped = preview.columns.some(
        c => c.mode === 'existing' && c.columnKey === col.key && c.sourceIndex !== null,
      );
      const blank = mapped ? preview.dataRows.filter(row => isBlank(row[col.key])).length : 0;
      return { title: col.title, blank, unmapped: !mapped };
    })
    .filter(item => item.unmapped || item.blank > 0);
}

export const selectionValue = (mapping: PasteColumnMapping): string =>
  mapping.mode === 'new' ? NEW : (mapping.columnKey ?? IGNORE);

/** Короткая подпись к угаданным настройкам: код валюты, процент, число вариантов. */
export const configChip = (
  mapping: PasteColumnMapping,
  optionsCountLabel: string,
): string | null => {
  const config = mapping.newConfig;
  if (!config) {
    return null;
  }
  if (mapping.newType === 'formula' && config.expression) {
    return 'ƒ';
  }
  if (mapping.newType === 'currency' && config.currency) {
    return config.currency;
  }
  if (mapping.newType === 'number' && config.format === 'percent') {
    return '%';
  }
  if (mapping.newType === 'select' && Array.isArray(config.options)) {
    return fill(optionsCountLabel, { count: config.options.length });
  }
  return null;
};
