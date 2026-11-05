import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, type Repository, type SelectQueryBuilder } from 'typeorm';
import { appError } from '../../common/errors/app-error';
import { CustomTableCellStyle } from '../../entities/custom-table-cell-style.entity';
import { CustomTableColumnType } from '../../entities/custom-table-column.entity';
import { CustomTableRow } from '../../entities/custom-table-row.entity';
import { CustomTableRelationsService } from './custom-table-relations.service';
import { CustomTableSupportService } from './custom-table-support.service';
import {
  type CustomTableAggregateDto,
  type CustomTableAggregateResult,
  type CustomTableRowFilterDto,
  type CustomTableRowSortDto,
} from './dto/list-custom-table-rows.dto';
import { applyFormulaColumns, mergeRowStyles } from './helpers/row-data';
import { applyRowFilters } from './helpers/row-filters';
import {
  applyRowSort,
  buildAggregateSelections,
  buildTypedValueExprs,
  normalizeAggregateValue,
} from './helpers/row-query';
import { throwHelpfulSchemaError } from './helpers/schema-error';

@Injectable()
export class CustomTableRowQueryService {
  private readonly logger = new Logger(CustomTableRowQueryService.name);

  constructor(
    @InjectRepository(CustomTableRow)
    private readonly customTableRowRepository: Repository<CustomTableRow>,
    @InjectRepository(CustomTableCellStyle)
    private readonly customTableCellStyleRepository: Repository<CustomTableCellStyle>,
    private readonly support: CustomTableSupportService,
    private readonly relations: CustomTableRelationsService,
  ) {}

  /**
   * Базовый запрос строк с фильтрами и сортировкой, но без пагинации.
   * Общий для выдачи строк и экспорта, чтобы выгрузка совпадала с тем,
   * что пользователь видит на экране.
   */
  async buildRowsQuery(
    tableId: string,
    params: { filters?: CustomTableRowFilterDto[]; sort?: CustomTableRowSortDto },
  ): Promise<SelectQueryBuilder<CustomTableRow>> {
    const query = this.customTableRowRepository
      .createQueryBuilder('r')
      .where('r.tableId = :tableId', { tableId })
      .orderBy('r.rowNumber', 'ASC')
      .addOrderBy('r.id', 'ASC');

    const rawFilters = params.filters?.filter(Boolean) || [];
    const typeByKey =
      rawFilters.length || params.sort
        ? await this.support.loadColumnTypeMap(tableId)
        : new Map<string, CustomTableColumnType>();

    applyRowFilters(query, rawFilters, typeByKey);
    if (params.sort) {
      applyRowSort(query, params.sort, typeByKey);
    }
    return query;
  }

  /**
   * Поиск дублей по составному ключу. Строки в таблицы попадают из разных
   * выписок, поэтому повторы неизбежны и ищутся не по точному совпадению
   * строки целиком, а по выбранным колонкам с нормализацией.
   */
  async findDuplicateRows(
    workspaceId: string,
    tableId: string,
    params: { keys: string[]; limit?: number },
  ): Promise<{
    items: Array<{ key: string; count: number; rowIds: string[]; rowNumbers: number[] }>;
    groupCount: number;
  }> {
    await this.support.requireTable(workspaceId, tableId);

    const keys = Array.from(new Set((params.keys ?? []).map(k => k.trim()).filter(Boolean)));
    if (!keys.length) {
      throw new BadRequestException(appError('DUPLICATE_KEY_COLUMNS_REQUIRED'));
    }
    if (keys.length > 10) {
      throw new BadRequestException(appError('DUPLICATE_KEY_TOO_MANY_COLUMNS'));
    }

    const typeByKey = await this.support.loadColumnTypeMap(tableId);
    for (const key of keys) {
      if (!typeByKey.has(key)) {
        throw new BadRequestException(appError('COLUMN_NOT_FOUND_NAMED', { column: String(key) }));
      }
    }

    const query = this.customTableRowRepository
      .createQueryBuilder('r')
      .where('r.tableId = :tableId', { tableId });

    // Регистр и лишние пробелы не должны мешать: «Магнум » и «магнум» — одно.
    const parts = keys.map((key, index) => {
      const param = `d_col_${index}`;
      query.setParameter(param, key);
      return `lower(trim(COALESCE(r.data ->> :${param}, '')))`;
    });
    // Разделитель — управляющий символ: в данных его не бывает, поэтому
    // склейка «аб|в» и «а|бв» не даст ложного совпадения.
    const keyExpr = parts.join(' || chr(31) || ');

    const safeLimit = Math.min(Math.max(params.limit ?? 100, 1), 500);
    const rows = await query
      .select([
        `${keyExpr} AS "dup_key"`,
        'COUNT(*) AS "dup_count"',
        'array_agg(r.id::text) AS "row_ids"',
        'array_agg(r.rowNumber) AS "row_numbers"',
      ])
      .groupBy(keyExpr)
      // Полностью пустой ключ — не дубль, а просто незаполненные строки.
      .having(`COUNT(*) > 1 AND ${keyExpr} <> ${keys.map(() => "''").join(' || chr(31) || ')}`)
      .orderBy('COUNT(*)', 'DESC')
      .limit(safeLimit)
      .getRawMany<Record<string, unknown>>();

    const items = rows.map(row => ({
      key: String(row.dup_key ?? '')
        .split('')
        .join(' · '),
      count: Number(row.dup_count) || 0,
      rowIds: Array.isArray(row.row_ids) ? (row.row_ids as string[]) : [],
      rowNumbers: Array.isArray(row.row_numbers)
        ? (row.row_numbers as unknown[]).map(n => Number(n))
        : [],
    }));

    return { items, groupCount: items.length };
  }

  /**
   * Итоги по колонкам. Считает база по всем строкам выборки — грид держит
   * в памяти лишь окно из 50 строк, и складывать надо не его.
   */
  async aggregateRows(
    workspaceId: string,
    tableId: string,
    params: { filters?: CustomTableRowFilterDto[]; aggs: CustomTableAggregateDto[] },
  ): Promise<{ items: CustomTableAggregateResult[]; total: number }> {
    await this.support.requireTable(workspaceId, tableId);

    const aggs = params.aggs?.filter(Boolean) ?? [];
    if (!aggs.length) {
      return { items: [], total: 0 };
    }
    if (aggs.length > 50) {
      throw new BadRequestException(appError('AGG_TOO_MANY'));
    }

    const typeByKey = await this.support.loadColumnTypeMap(tableId);
    const query = await this.buildRowsQuery(tableId, { filters: params.filters });
    const total = await query.getCount();

    // ORDER BY из базового запроса несовместим с агрегацией без GROUP BY.
    query.orderBy();

    const selections = buildAggregateSelections(query, aggs, typeByKey);

    const raw = await query.select(selections).getRawOne<Record<string, unknown>>();

    const items = aggs.map((agg, index) => ({
      col: agg.col,
      fn: agg.fn,
      value: normalizeAggregateValue(raw?.[`agg_${index}`]),
    }));

    return { items, total };
  }

  /**
   * Группировка с итогами по каждой группе. Считает база: собрать группы
   * из подгруженного окна строк нельзя — они охватывают всю выборку.
   */
  async groupRows(
    workspaceId: string,
    tableId: string,
    params: {
      groupBy: string;
      filters?: CustomTableRowFilterDto[];
      aggs?: CustomTableAggregateDto[];
      limit?: number;
    },
  ): Promise<{
    items: Array<{
      key: string | null;
      count: number;
      aggregates: CustomTableAggregateResult[];
    }>;
    groupCount: number;
  }> {
    await this.support.requireTable(workspaceId, tableId);

    const groupBy = params.groupBy?.trim();
    if (!groupBy) {
      throw new BadRequestException(appError('GROUP_COLUMN_REQUIRED'));
    }

    const typeByKey = await this.support.loadColumnTypeMap(tableId);
    if (!typeByKey.has(groupBy)) {
      throw new BadRequestException(
        appError('GROUP_COLUMN_NOT_FOUND', { column: String(groupBy) }),
      );
    }

    const aggs = params.aggs?.filter(Boolean) ?? [];
    if (aggs.length > 50) {
      throw new BadRequestException(appError('AGG_TOO_MANY'));
    }

    const query = await this.buildRowsQuery(tableId, { filters: params.filters });
    // Порядок строк из базового запроса к группам отношения не имеет.
    query.orderBy();

    const groupExpr = buildTypedValueExprs('g_col').textExpr;
    query.setParameter('g_col', groupBy);

    const selections = [
      `${groupExpr} AS "group_key"`,
      'COUNT(*) AS "group_count"',
      ...buildAggregateSelections(query, aggs, typeByKey),
    ];

    const safeLimit = Math.min(Math.max(params.limit ?? 200, 1), 1000);
    const rows = await query
      .select(selections)
      .groupBy(groupExpr)
      // Крупные группы первыми: с них обычно и начинают разбираться.
      .orderBy('COUNT(*)', 'DESC')
      .limit(safeLimit)
      .getRawMany<Record<string, unknown>>();

    const items = rows.map(row => ({
      key: row.group_key === null || row.group_key === undefined ? null : String(row.group_key),
      count: Number(row.group_count) || 0,
      aggregates: aggs.map((agg, index) => ({
        col: agg.col,
        fn: agg.fn,
        value: normalizeAggregateValue(row[`agg_${index}`]),
      })),
    }));

    return { items, groupCount: items.length };
  }

  async listRows(
    workspaceId: string,
    tableId: string,
    params: {
      cursor?: number;
      offset?: number;
      limit: number;
      filters?: CustomTableRowFilterDto[];
      sort?: CustomTableRowSortDto;
    },
  ): Promise<{ items: CustomTableRow[]; total: number }> {
    await this.support.requireTable(workspaceId, tableId);

    const query = await this.buildRowsQuery(tableId, params);
    query.take(params.limit);

    const total = await query.getCount();

    if (params.sort) {
      // Keyset-курсор по rowNumber верен только при сортировке по rowNumber.
      // При произвольной сортировке страницы нарезаются смещением.
      query.skip(params.offset ?? 0);
    } else if (params.cursor !== undefined) {
      query.andWhere('r.rowNumber > :cursor', { cursor: params.cursor });
    }

    try {
      const rows = await query.getMany();
      if (!rows.length) {
        return { items: [], total };
      }

      try {
        const rowIds = rows.map(r => r.id);
        const styles = await this.customTableCellStyleRepository.find({
          where: { rowId: In(rowIds) },
          select: {
            rowId: true,
            columnKey: true,
            style: true,
          },
        });
        mergeRowStyles(rows, styles);
      } catch (_error) {
        this.logger.warn(`Failed to load cell styles for tableId=${tableId}`);
      }

      const tableColumns = await this.support.loadColumnsWithConfig(tableId);
      applyFormulaColumns(rows, tableColumns);
      await this.relations.applyRelationLabels(rows, tableColumns);

      return { items: rows, total };
    } catch (error) {
      throwHelpfulSchemaError(error);
    }
  }
}
