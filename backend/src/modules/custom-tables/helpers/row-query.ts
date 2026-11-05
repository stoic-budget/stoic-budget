import { BadRequestException } from '@nestjs/common';
import { type SelectQueryBuilder } from 'typeorm';
import { appError } from '../../../common/errors/app-error';
import { neutralizeSpreadsheetFormulaCell } from '../../../common/utils/spreadsheet-formula.util';
import {
  CustomTableColumn,
  CustomTableColumnType,
} from '../../../entities/custom-table-column.entity';
import { CustomTableRow } from '../../../entities/custom-table-row.entity';
import {
  CUSTOM_TABLE_AGGREGATE_FNS,
  type CustomTableAggregateDto,
  type CustomTableRowSortDto,
} from '../dto/list-custom-table-rows.dto';

/**
 * Деньги — это число с оформлением: сравнения, сортировка, итоги и выгрузка
 * обязаны обращаться с ними так же, как с NUMBER.
 */
export function isNumericColumnType(columnType: CustomTableColumnType): boolean {
  return (
    columnType === CustomTableColumnType.NUMBER || columnType === CustomTableColumnType.CURRENCY
  );
}

/**
 * Значения строк лежат в jsonb как текст, поэтому сравнение по типу колонки
 * требует приведения. Выражения общие для фильтрации и сортировки — иначе
 * фильтр и сортировка по одной колонке трактуют её по-разному.
 */
export function buildTypedValueExprs(colParam: string): {
  textExpr: string;
  textCoalescedExpr: string;
  numericExpr: string;
  dateExpr: string;
  boolExpr: string;
} {
  // Формульные колонки лежат в computed: фильтры, сортировка и итоги видят их так же.
  const textExpr = `COALESCE(r.data ->> :${colParam}, r.computed ->> :${colParam})`;
  return {
    textExpr,
    textCoalescedExpr: `COALESCE(${textExpr}, '')`,
    numericExpr: `(CASE WHEN ${textExpr} ~ '^\\s*-?\\d+(?:\\.\\d+)?\\s*$' THEN (${textExpr})::numeric ELSE NULL END)`,
    dateExpr: `(CASE
        WHEN ${textExpr} ~ '^\\d{4}-\\d{2}-\\d{2}$' THEN (${textExpr})::date
        WHEN ${textExpr} ~ '^\\d{2}\\.\\d{2}\\.\\d{4}$' THEN to_date(${textExpr}, 'DD.MM.YYYY')
        ELSE NULL
      END)`,
    boolExpr: `(CASE
        WHEN lower(${textExpr}) IN ('true','t','1','yes','y') THEN true
        WHEN lower(${textExpr}) IN ('false','f','0','no','n') THEN false
        ELSE NULL
      END)`,
  };
}

export function sortExprForColumnType(colParam: string, columnType: CustomTableColumnType): string {
  const exprs = buildTypedValueExprs(colParam);
  switch (columnType) {
    case CustomTableColumnType.NUMBER:
    case CustomTableColumnType.CURRENCY:
      return exprs.numericExpr;
    case CustomTableColumnType.DATE:
      return exprs.dateExpr;
    case CustomTableColumnType.BOOLEAN:
      return exprs.boolExpr;
    default:
      return exprs.textExpr;
  }
}

export function applyRowSort(
  query: SelectQueryBuilder<CustomTableRow>,
  sort: CustomTableRowSortDto,
  typeByKey: Map<string, CustomTableColumnType>,
): void {
  const col = sort.col?.trim();
  if (!col) {
    throw new BadRequestException(appError('SORT_INVALID'));
  }
  const columnType = typeByKey.get(col);
  if (!columnType) {
    throw new BadRequestException(appError('SORT_COLUMN_NOT_FOUND', { column: String(col) }));
  }
  const direction = sort.dir === 'desc' ? 'DESC' : 'ASC';
  const sortExpr = sortExprForColumnType('s_col', columnType);
  // Пустые ячейки всегда внизу — иначе при DESC список открывается пустотой.
  query
    .orderBy(sortExpr, direction, 'NULLS LAST')
    .addOrderBy('r.rowNumber', 'ASC')
    .setParameter('s_col', col);
}

/** A column title is editor input: it must not open as a formula in the header row. */
export function exportHeader(col: CustomTableColumn): string {
  return neutralizeSpreadsheetFormulaCell(col.title || col.key);
}

export function exportCellValue(raw: unknown, columnType: CustomTableColumnType): unknown {
  if (raw === null || raw === undefined) {
    return '';
  }
  if (Array.isArray(raw)) {
    return neutralizeSpreadsheetFormulaCell(raw.map(v => String(v ?? '')).join(', '));
  }
  if (isNumericColumnType(columnType)) {
    const num = Number(raw);
    return Number.isFinite(num) ? num : String(raw);
  }
  if (columnType === CustomTableColumnType.BOOLEAN) {
    if (typeof raw === 'boolean') {
      return raw;
    }
    const text = String(raw).toLowerCase();
    if (['true', 't', '1', 'yes', 'y'].includes(text)) {
      return true;
    }
    if (['false', 'f', '0', 'no', 'n'].includes(text)) {
      return false;
    }
    return String(raw);
  }
  if (typeof raw === 'object') {
    return neutralizeSpreadsheetFormulaCell(JSON.stringify(raw));
  }
  // Numbers and booleans returned above stay typed; only free text can carry
  // a leading formula character.
  return neutralizeSpreadsheetFormulaCell(String(raw));
}

/**
 * SELECT-выражения агрегатов с алиасами agg_0..agg_N. Общие для плоских
 * итогов и для группировки, чтобы одна и та же функция считалась одинаково.
 */
export function buildAggregateSelections(
  query: SelectQueryBuilder<CustomTableRow>,
  aggs: CustomTableAggregateDto[],
  typeByKey: Map<string, CustomTableColumnType>,
): string[] {
  return aggs.map((agg, index) => {
    const col = agg.col?.trim();
    if (!col) {
      throw new BadRequestException(appError('AGG_INVALID'));
    }
    const columnType = typeByKey.get(col);
    if (!columnType) {
      throw new BadRequestException(appError('AGG_COLUMN_NOT_FOUND', { column: String(col) }));
    }
    if (!CUSTOM_TABLE_AGGREGATE_FNS.includes(agg.fn)) {
      throw new BadRequestException(appError('AGG_FUNCTION_UNKNOWN', { fn: String(agg.fn) }));
    }

    const colParam = `a_col_${index}`;
    const exprs = buildTypedValueExprs(colParam);
    query.setParameter(colParam, col);

    if (agg.fn === 'count') {
      // Считаем заполненные ячейки: пустые в итог не идут.
      return `COUNT(NULLIF(${exprs.textCoalescedExpr}, '')) AS "agg_${index}"`;
    }
    if (isNumericColumnType(columnType)) {
      return `${agg.fn.toUpperCase()}(${exprs.numericExpr}) AS "agg_${index}"`;
    }
    if (columnType === CustomTableColumnType.DATE && (agg.fn === 'min' || agg.fn === 'max')) {
      return `${agg.fn.toUpperCase()}(${exprs.dateExpr}) AS "agg_${index}"`;
    }
    throw new BadRequestException(
      appError('AGG_FUNCTION_UNSUPPORTED', { fn: String(agg.fn), type: String(columnType) }),
    );
  });
}

/** Приводит сырое значение агрегата из БД к числу или дате. */
export function normalizeAggregateValue(value: unknown): number | string | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  const num = Number(value);
  return Number.isFinite(num) ? num : String(value);
}
