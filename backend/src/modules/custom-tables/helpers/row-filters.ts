import { BadRequestException } from '@nestjs/common';
import { type SelectQueryBuilder } from 'typeorm';
import { appError } from '../../../common/errors/app-error';
import { CustomTableColumnType } from '../../../entities/custom-table-column.entity';
import { CustomTableRow } from '../../../entities/custom-table-row.entity';
import { type CustomTableRowFilterDto } from '../dto/list-custom-table-rows.dto';
import { buildTypedValueExprs, isNumericColumnType } from './row-query';

export type QueryParams = Record<string, string | number | boolean | string[] | number[] | null>;

export function applyRowFilters(
  query: SelectQueryBuilder<CustomTableRow>,
  rawFilters: CustomTableRowFilterDto[],
  typeByKey: Map<string, CustomTableColumnType>,
): void {
  if (rawFilters.length) {
    if (rawFilters.length > 50) {
      throw new BadRequestException(appError('FILTER_TOO_MANY'));
    }

    rawFilters.forEach((filter, index) => {
      const op = filter?.op;
      if (!op) {
        throw new BadRequestException(appError('FILTER_INVALID'));
      }

      if (op === 'search') {
        const rawValue =
          typeof filter.value === 'string'
            ? filter.value.trim()
            : String(filter.value ?? '').trim();
        if (!rawValue) {
          return;
        }
        const valueParam = `f_val_${index}`;
        query.andWhere(`r.data::text ILIKE :${valueParam}`, {
          [valueParam]: `%${rawValue}%`,
        });
        return;
      }

      const col = filter?.col?.trim();
      if (!col) {
        throw new BadRequestException(appError('FILTER_INVALID'));
      }
      const columnType = typeByKey.get(col);
      if (!columnType) {
        throw new BadRequestException(appError('FILTER_COLUMN_NOT_FOUND', { column: String(col) }));
      }

      const colParam = `f_col_${index}`;
      const valueParam = `f_val_${index}`;
      const valueParam2 = `f_val2_${index}`;
      const valuesParam = `f_vals_${index}`;

      const { textExpr, textCoalescedExpr, numericExpr, dateExpr, boolExpr } =
        buildTypedValueExprs(colParam);

      const apply = (sql: string, paramsObj: QueryParams) => {
        query.andWhere(sql, paramsObj);
      };

      const withCol = (paramsObj: QueryParams): QueryParams => ({
        ...paramsObj,
        [colParam]: col,
      });

      switch (op) {
        case 'isEmpty': {
          if (columnType === CustomTableColumnType.MULTI_SELECT) {
            apply(
              `(r.data -> :${colParam} IS NULL OR r.data -> :${colParam} = '[]'::jsonb)`,
              withCol({}),
            );
            break;
          }
          apply(`(${textExpr} IS NULL OR ${textExpr} = '')`, withCol({}));
          break;
        }
        case 'isNotEmpty': {
          if (columnType === CustomTableColumnType.MULTI_SELECT) {
            apply(
              `(r.data -> :${colParam} IS NOT NULL AND r.data -> :${colParam} <> '[]'::jsonb)`,
              withCol({}),
            );
            break;
          }
          apply(`(${textExpr} IS NOT NULL AND ${textExpr} <> '')`, withCol({}));
          break;
        }
        case 'contains': {
          const value =
            typeof filter.value === 'string'
              ? filter.value.trim()
              : String(filter.value ?? '').trim();
          if (!value) {
            return;
          }
          apply(
            `${textCoalescedExpr} ILIKE :${valueParam}`,
            withCol({ [valueParam]: `%${value}%` }),
          );
          break;
        }
        case 'startsWith': {
          const value =
            typeof filter.value === 'string'
              ? filter.value.trim()
              : String(filter.value ?? '').trim();
          if (!value) {
            return;
          }
          apply(
            `${textCoalescedExpr} ILIKE :${valueParam}`,
            withCol({ [valueParam]: `${value}%` }),
          );
          break;
        }
        case 'eq':
        case 'neq': {
          const isNeq = op === 'neq';
          if (isNumericColumnType(columnType)) {
            const value = Number(filter.value);
            if (!Number.isFinite(value)) {
              return;
            }
            apply(
              `${numericExpr} ${isNeq ? 'IS DISTINCT FROM' : '='} :${valueParam}`,
              withCol({ [valueParam]: value }),
            );
            break;
          }
          if (columnType === CustomTableColumnType.DATE) {
            const value =
              typeof filter.value === 'string'
                ? filter.value.trim()
                : String(filter.value ?? '').trim();
            if (!value) {
              return;
            }
            apply(
              `${dateExpr} ${isNeq ? 'IS DISTINCT FROM' : '='} :${valueParam}`,
              withCol({ [valueParam]: value }),
            );
            break;
          }
          if (columnType === CustomTableColumnType.BOOLEAN) {
            const raw =
              typeof filter.value === 'boolean' ? filter.value : String(filter.value ?? '').trim();
            if (raw === '') {
              return;
            }
            const value =
              typeof raw === 'boolean'
                ? raw
                : ['true', '1', 'yes', 'y', 't'].includes(raw.toLowerCase());
            apply(
              `${boolExpr} ${isNeq ? 'IS DISTINCT FROM' : '='} :${valueParam}`,
              withCol({ [valueParam]: value }),
            );
            break;
          }
          if (columnType === CustomTableColumnType.MULTI_SELECT) {
            const value =
              typeof filter.value === 'string'
                ? filter.value.trim()
                : String(filter.value ?? '').trim();
            if (!value) {
              return;
            }
            apply(
              `(CASE WHEN jsonb_typeof(r.data -> :${colParam}) = 'array'
                THEN ${isNeq ? 'NOT ' : ''}EXISTS (
                  SELECT 1 FROM jsonb_array_elements_text(r.data -> :${colParam}) AS elem
                  WHERE elem = :${valueParam}
                )
                ELSE ${isNeq ? 'true' : 'false'} END)`,
              withCol({ [valueParam]: value }),
            );
            break;
          }
          {
            const value =
              typeof filter.value === 'string'
                ? filter.value.trim()
                : String(filter.value ?? '').trim();
            if (!value && value !== '') {
              return;
            }
            apply(
              `${textExpr} ${isNeq ? 'IS DISTINCT FROM' : '='} :${valueParam}`,
              withCol({ [valueParam]: value }),
            );
            break;
          }
        }
        case 'gt':
        case 'gte':
        case 'lt':
        case 'lte': {
          const cmp = op === 'gt' ? '>' : op === 'gte' ? '>=' : op === 'lt' ? '<' : '<=';
          if (isNumericColumnType(columnType)) {
            const value = Number(filter.value);
            if (!Number.isFinite(value)) {
              return;
            }
            apply(`${numericExpr} ${cmp} :${valueParam}`, withCol({ [valueParam]: value }));
            break;
          }
          if (columnType === CustomTableColumnType.DATE) {
            const value =
              typeof filter.value === 'string'
                ? filter.value.trim()
                : String(filter.value ?? '').trim();
            if (!value) {
              return;
            }
            apply(`${dateExpr} ${cmp} :${valueParam}`, withCol({ [valueParam]: value }));
            break;
          }
          throw new BadRequestException(
            appError('FILTER_OPERATOR_UNSUPPORTED', {
              operator: String(op),
              type: String(columnType),
            }),
          );
        }
        case 'between': {
          const value = filter.value;
          const arr = Array.isArray(value) ? value : undefined;
          if (!arr || arr.length < 2) {
            return;
          }
          const [rawMin, rawMax] = arr;
          if (isNumericColumnType(columnType)) {
            const min = Number(rawMin);
            const max = Number(rawMax);
            if (!(Number.isFinite(min) && Number.isFinite(max))) {
              return;
            }
            apply(
              `${numericExpr} BETWEEN :${valueParam} AND :${valueParam2}`,
              withCol({ [valueParam]: min, [valueParam2]: max }),
            );
            break;
          }
          if (columnType === CustomTableColumnType.DATE) {
            const min = typeof rawMin === 'string' ? rawMin.trim() : String(rawMin ?? '').trim();
            const max = typeof rawMax === 'string' ? rawMax.trim() : String(rawMax ?? '').trim();
            if (!(min && max)) {
              return;
            }
            apply(
              `${dateExpr} BETWEEN :${valueParam} AND :${valueParam2}`,
              withCol({ [valueParam]: min, [valueParam2]: max }),
            );
            break;
          }
          throw new BadRequestException(
            appError('FILTER_BETWEEN_UNSUPPORTED', { type: String(columnType) }),
          );
        }
        case 'in': {
          const value = filter.value;
          const arr = Array.isArray(value)
            ? value
            : typeof value === 'string'
              ? value.split(',')
              : [];
          const values = arr.map(v => String(v).trim()).filter(Boolean);
          if (!values.length) {
            return;
          }

          if (columnType === CustomTableColumnType.MULTI_SELECT) {
            apply(
              `(CASE WHEN jsonb_typeof(r.data -> :${colParam}) = 'array'
                THEN EXISTS (
                  SELECT 1 FROM jsonb_array_elements_text(r.data -> :${colParam}) AS elem
                  WHERE elem IN (:...${valuesParam})
                )
                ELSE false END)`,
              withCol({ [valuesParam]: values }),
            );
            break;
          }

          if (isNumericColumnType(columnType)) {
            const nums = values.map(v => Number(v)).filter(v => Number.isFinite(v));
            if (!nums.length) {
              return;
            }
            apply(`${numericExpr} IN (:...${valuesParam})`, withCol({ [valuesParam]: nums }));
            break;
          }

          apply(`${textExpr} IN (:...${valuesParam})`, withCol({ [valuesParam]: values }));
          break;
        }
        default:
          throw new BadRequestException(
            appError('FILTER_OPERATOR_UNKNOWN', { operator: String(op) }),
          );
      }
    });
  }
}
