import { BadRequestException } from '@nestjs/common';
import { appError } from '../../../common/errors/app-error';
import type { ColumnStylePartInput, UpdateCustomTableColumnStyleBody } from '../../../contracts';
import {
  CustomTableColumn,
  CustomTableColumnType,
} from '../../../entities/custom-table-column.entity';
import { type FormulaResultType } from './formula-evaluator';
import { type JsonObject } from './row-data';

/**
 * Опции select: строки или объекты { value, label?, color? }; значения
 * уникальны, цвет — #rrggbb. В ячейке хранится только value.
 */
export function validateSelectConfig(
  type: CustomTableColumnType | undefined,
  config: Record<string, unknown> | null | undefined,
): void {
  if (
    !config ||
    config.options === undefined ||
    (type !== CustomTableColumnType.SELECT && type !== CustomTableColumnType.MULTI_SELECT)
  ) {
    return;
  }
  const raw = config.options;
  if (!Array.isArray(raw)) {
    throw new BadRequestException(appError('COLUMN_OPTIONS_INVALID'));
  }
  const seen = new Set<string>();
  for (const item of raw) {
    const value =
      typeof item === 'string'
        ? item.trim()
        : item &&
            typeof item === 'object' &&
            typeof (item as { value?: unknown }).value === 'string'
          ? ((item as { value: string }).value ?? '').trim()
          : '';
    const color =
      item && typeof item === 'object' ? (item as { color?: unknown }).color : undefined;
    const label =
      item && typeof item === 'object' ? (item as { label?: unknown }).label : undefined;
    const colorOk =
      color === undefined || (typeof color === 'string' && /^#[0-9a-f]{6}$/i.test(color));
    const labelOk = label === undefined || typeof label === 'string';
    if (!value || seen.has(value) || !colorOk || !labelOk) {
      throw new BadRequestException(appError('COLUMN_OPTIONS_INVALID'));
    }
    seen.add(value);
  }
}

/**
 * Валюта, точность и формат числовых колонок: невалидный код валюты ронял
 * бы Intl в браузере, а точность вне 0..6 бессмысленна для денег.
 * Код валюты нормализуется к верхнему регистру прямо в конфиге.
 */
export function validateNumberConfig(
  type: CustomTableColumnType | undefined,
  config: Record<string, unknown> | null | undefined,
): void {
  if (!config) {
    return;
  }
  const numeric =
    type === CustomTableColumnType.NUMBER ||
    type === CustomTableColumnType.CURRENCY ||
    type === CustomTableColumnType.FORMULA;
  if (!numeric) {
    return;
  }
  if (config.currency !== undefined) {
    const code = String(config.currency).trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(code)) {
      throw new BadRequestException(appError('COLUMN_CURRENCY_INVALID'));
    }
    config.currency = code;
  }
  if (config.precision !== undefined) {
    const precision = config.precision;
    if (
      typeof precision !== 'number' ||
      !Number.isInteger(precision) ||
      precision < 0 ||
      precision > 6
    ) {
      throw new BadRequestException(appError('COLUMN_PRECISION_INVALID'));
    }
  }
  if (config.format !== undefined && config.format !== 'plain' && config.format !== 'percent') {
    throw new BadRequestException(appError('COLUMN_FORMAT_INVALID'));
  }
}

/**
 * Формула проверяется при сохранении колонки: здесь ошибку надо показать,
 * в отличие от вычисления строк, где сбой даёт пустую ячейку.
 */
/**
 * Названия колонок в [квадратных скобках] переводятся в ключи: человек пишет
 * [Сумма], а хранится [col_…], поэтому переименование колонки формулу не ломает.
 */
export function resolveFormulaTitles(
  expression: string,
  columns: Array<{ key: string; title: string }>,
): string {
  const keys = new Set(columns.map(col => col.key));
  const byTitle = new Map(columns.map(col => [col.title.trim().toLowerCase(), col.key]));
  return expression.replace(/\[([^\]]{1,120})\]/g, (match, ref: string) => {
    const trimmed = ref.trim();
    if (keys.has(trimmed)) {
      return `[${trimmed}]`;
    }
    const key = byTitle.get(trimmed.toLowerCase());
    return key ? `[${key}]` : match;
  });
}

export function formulaTypeOfColumn(column: {
  type: CustomTableColumnType;
  config: CustomTableColumn['config'];
}): FormulaResultType {
  switch (column.type) {
    case CustomTableColumnType.NUMBER:
    case CustomTableColumnType.CURRENCY:
      return 'number';
    case CustomTableColumnType.DATE:
      return 'date';
    case CustomTableColumnType.BOOLEAN:
      return 'boolean';
    case CustomTableColumnType.FORMULA: {
      const declared = column.config?.resultType;
      return declared === 'text' || declared === 'boolean' || declared === 'date'
        ? declared
        : 'number';
    }
    default:
      return 'text';
  }
}

export function formulaHasCycle(start: string, refsByKey: Map<string, string[]>): boolean {
  const visited = new Set<string>();
  const stack = [...(refsByKey.get(start) ?? [])];
  while (stack.length) {
    const key = stack.pop() as string;
    if (key === start) {
      return true;
    }
    if (visited.has(key)) {
      continue;
    }
    visited.add(key);
    stack.push(...(refsByKey.get(key) ?? []));
  }
  return false;
}

export function describeValidationError(error: unknown): string {
  if (error instanceof BadRequestException) {
    const response = error.getResponse();
    if (typeof response === 'string') {
      return response;
    }
    const message = (response as { message?: unknown }).message;
    return Array.isArray(message) ? message.join('; ') : String(message ?? 'Invalid formula');
  }
  return error instanceof Error ? error.message : 'Invalid formula';
}

export function mergeColumnStyle(
  before: JsonObject | null,
  dto: UpdateCustomTableColumnStyleBody,
): JsonObject {
  const next: JsonObject = { ...(before ?? {}) };
  for (const part of ['header', 'cell'] as const) {
    const value = dto[part];
    if (value === undefined) {
      continue;
    }
    const normalized = value === null ? null : normalizeColumnStylePart(value);
    if (normalized) {
      next[part] = normalized;
    } else {
      delete next[part];
    }
  }
  return next;
}

/** Оставляем только заполненные поля; пустая часть превращается в null. */
export function normalizeColumnStylePart(part: ColumnStylePartInput): JsonObject | null {
  const result: JsonObject = {};
  if (part.backgroundColor) {
    result.backgroundColor = part.backgroundColor;
  }
  const textFormat: JsonObject = {};
  if (part.textFormat?.foregroundColor) {
    textFormat.foregroundColor = part.textFormat.foregroundColor;
  }
  if (typeof part.textFormat?.bold === 'boolean') {
    textFormat.bold = part.textFormat.bold;
  }
  if (Object.keys(textFormat).length) {
    result.textFormat = textFormat;
  }
  return Object.keys(result).length ? result : null;
}

/** Формульная колонка для SQL — это её тип результата: число, дата, флаг или текст. */
export function storageTypeOf(column: {
  type: CustomTableColumnType;
  config: CustomTableColumn['config'];
}): CustomTableColumnType {
  if (column.type !== CustomTableColumnType.FORMULA) {
    return column.type;
  }
  switch (formulaTypeOfColumn(column)) {
    case 'date':
      return CustomTableColumnType.DATE;
    case 'boolean':
      return CustomTableColumnType.BOOLEAN;
    case 'text':
      return CustomTableColumnType.TEXT;
    default:
      return CustomTableColumnType.NUMBER;
  }
}
