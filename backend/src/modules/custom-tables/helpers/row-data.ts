import { randomUUID } from 'node:crypto';
import { CustomTable } from '../../../entities/custom-table.entity';
import { CustomTableCellStyle } from '../../../entities/custom-table-cell-style.entity';
import { CustomTableColumn } from '../../../entities/custom-table-column.entity';
import { CustomTableColumnStyle } from '../../../entities/custom-table-column-style.entity';
import { CustomTableRow } from '../../../entities/custom-table-row.entity';
import { type CustomTableAggregateFn } from '../dto/list-custom-table-rows.dto';
import { formulaColumnsOf } from '../formula-recalc.service';
import type { SourceValue } from '../sources/source.types';
import { evaluateFormula } from './formula-evaluator';
import { orderFormulaColumns } from './table-evaluator';

export type ViewSettingsColumns = Record<
  string,
  { width?: number; aggregate?: CustomTableAggregateFn }
>;

export type ColumnWithStyle = CustomTableColumn & {
  style?: CustomTableColumnStyle['style'] | null;
};

export type RowStylesRecord = Record<string, JsonObject>;

export type RowDataRecord = Record<string, RowDataValue>;

export type RowDataValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | JsonObject
  | RowDataValue[];

export type CustomTableWithViewSettings = CustomTable & { viewSettings?: JsonObject };
export type ColumnDefinitionConfig = JsonObject | null;
export type RowInsertData = Record<string, string | number | null>;
export type JsonObject = Record<string, unknown>;

export function toRowDataRecord(data: unknown): RowDataRecord {
  return typeof data === 'object' && data !== null && !Array.isArray(data)
    ? (data as RowDataRecord)
    : {};
}

export function getRowDataValue(data: Record<string, unknown>, key: string): unknown {
  return data[key];
}

export function getViewSettingsObject(table: CustomTable): JsonObject {
  return table.viewSettings && typeof table.viewSettings === 'object'
    ? (table.viewSettings as JsonObject)
    : {};
}

export function getViewSettingsColumns(viewSettings: JsonObject): ViewSettingsColumns {
  const columns = viewSettings.columns;
  return typeof columns === 'object' && columns !== null ? (columns as ViewSettingsColumns) : {};
}

export function attachColumnStyles(
  columns: CustomTableColumn[],
  stylesByKey: Map<string, CustomTableColumnStyle['style']>,
): ColumnWithStyle[] {
  return columns.map(column => {
    const columnWithStyle = column as ColumnWithStyle;
    columnWithStyle.style = stylesByKey.get(column.key) || null;
    return columnWithStyle;
  });
}

export function mergeRowStyles(
  rows: CustomTableRow[],
  cellStyles: CustomTableCellStyle[],
): CustomTableRow[] {
  const stylesByRowId = new Map<string, JsonObject>();
  rows.forEach(row => {
    if (row.styles && typeof row.styles === 'object') {
      stylesByRowId.set(row.id, row.styles as JsonObject);
    }
  });

  const byRow: RowStylesRecord = {};
  for (const style of cellStyles) {
    const current = byRow[style.rowId] || {};
    current[style.columnKey] = style.style as JsonObject;
    byRow[style.rowId] = current;
  }

  rows.forEach(row => {
    row.styles = {
      ...(byRow[row.id] || {}),
      ...(stylesByRowId.get(row.id) || {}),
    };
  });

  return rows;
}

export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function sanitizeRowData(
  data: Record<string, unknown>,
  allowedKeys: Set<string>,
): Record<string, unknown> {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return {};
  }

  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (allowedKeys.has(key)) {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

export function getPaidStatusFieldKeys(columns: CustomTableColumn[]): {
  commentKeys: string[];
  counterpartyKeys: string[];
} {
  const commentPatterns = [
    /comment/i,
    /purpose/i,
    /description/i,
    /note/i,
    /memo/i,
    /details/i,
    /назнач/i,
    /комментар/i,
    /описан/i,
    /примеч/i,
    /платеж/i,
  ];
  const counterpartyPatterns = [
    /counterparty/i,
    /merchant/i,
    /supplier/i,
    /partner/i,
    /vendor/i,
    /payer/i,
    /receiver/i,
    /beneficiar/i,
    /контраг/i,
    /получател/i,
    /плательщик/i,
    /бенефиц/i,
  ];

  const commentKeys: string[] = [];
  const counterpartyKeys: string[] = [];
  for (const column of columns) {
    const hay = `${column.title || ''} ${column.key || ''}`.toLowerCase();
    if (commentPatterns.some(re => re.test(hay))) {
      commentKeys.push(column.key);
    }
    if (counterpartyPatterns.some(re => re.test(hay))) {
      counterpartyKeys.push(column.key);
    }
  }
  return { commentKeys, counterpartyKeys };
}

export function collectRowText(data: Record<string, unknown>, keys: string[]): string {
  if (!data || typeof data !== 'object') {
    return '';
  }
  const parts: string[] = [];
  for (const key of keys) {
    const value = getRowDataValue(data, key);
    if (value === null || value === undefined) {
      continue;
    }
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item === null || item === undefined) {
          continue;
        }
        if (typeof item === 'object') {
          continue;
        }
        const str = String(item).trim();
        if (str) {
          parts.push(str);
        }
      }
      continue;
    }
    if (typeof value === 'object') {
      continue;
    }
    const str = String(value).trim();
    if (str) {
      parts.push(str);
    }
  }
  return parts.join(' ').trim();
}

export function sameCellValue(current: unknown, next: SourceValue): boolean {
  return JSON.stringify(current ?? null) === JSON.stringify(next ?? null);
}

export function readSummaries(
  table: CustomTable,
): Array<{ id: string; title: string; expression: string }> {
  const raw = getViewSettingsObject(table).summaries;
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw
    .filter(
      (item): item is { id: string; title: string; expression: string } =>
        typeof item === 'object' &&
        item !== null &&
        typeof (item as { expression?: unknown }).expression === 'string',
    )
    .map(item => ({
      id: String(item.id ?? randomUUID()),
      title: String(item.title ?? ''),
      expression: item.expression,
    }));
}

/**
 * Значения формул живут в `computed` и пишутся пересчётом после каждой
 * записи; здесь они подмешиваются в data для выдачи. Строка, которую
 * пересчёт ещё не видел, получает значение на лету — без табличного
 * контекста, но без пустых ячеек.
 */
export function applyFormulaColumns(rows: CustomTableRow[], columns: CustomTableColumn[]): void {
  const formulaColumns = orderFormulaColumns(formulaColumnsOf(columns));
  if (!formulaColumns.length) {
    return;
  }
  for (const row of rows) {
    const data = (row.data ?? {}) as Record<string, unknown>;
    const computed = toRowDataRecord(row.computed);
    for (const col of formulaColumns) {
      data[col.key] =
        col.key in computed ? computed[col.key] : evaluateFormula(col.expression, data);
    }
    row.data = data;
  }
}

export function isBlankCellValue(value: unknown): boolean {
  if (value === null || value === undefined) {
    return true;
  }
  if (Array.isArray(value)) {
    return value.length === 0;
  }
  return String(value).trim() === '';
}
