import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Cache } from 'cache-manager';
import { In, MoreThanOrEqual, type Repository } from 'typeorm';
import { appError } from '../../common/errors/app-error';
import type { CustomTablesSummaryBody } from '../../contracts';
import { CustomTable } from '../../entities/custom-table.entity';
import { CustomTableColumn } from '../../entities/custom-table-column.entity';
import { CustomTableRow } from '../../entities/custom-table-row.entity';
import { UNCATEGORIZED_CATEGORY_NAME } from '../categories/uncategorized-category';
import { loadTableColumns } from './helpers/custom-table-columns.loader';
import { getReportsVersion } from './helpers/report-query.util';
import { normalizeText, parseDate, parseNumber, toDateKey } from './helpers/report-values.util';
import type {
  AvailableCustomTable,
  CustomTablesSummaryResponse,
} from './interfaces/custom-tables-report.interface';

/** Income, expense and their top categories and counterparties across custom tables. */
@Injectable()
export class CustomTablesSummaryReport {
  constructor(
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    @InjectRepository(CustomTable)
    private readonly customTableRepository: Repository<CustomTable>,
    @InjectRepository(CustomTableColumn)
    private readonly customTableColumnRepository: Repository<CustomTableColumn>,
    @InjectRepository(CustomTableRow)
    private readonly customTableRowRepository: Repository<CustomTableRow>,
  ) {}

  async getCustomTablesSummary(
    workspaceId: string,
    dto: CustomTablesSummaryBody,
  ): Promise<CustomTablesSummaryResponse> {
    const version = await getReportsVersion(this.cacheManager, workspaceId);
    const cacheKey = `reports:custom-tables:${workspaceId}:${version}:${JSON.stringify(dto)}`;
    const cached = await this.cacheManager.get<CustomTablesSummaryResponse>(cacheKey);
    if (cached) {
      return cached;
    }

    const safeDays =
      Number.isFinite(dto.days) && (dto.days as number) > 0
        ? Math.min(dto.days as number, 3650)
        : 30;
    const since = new Date();
    since.setDate(since.getDate() - safeDays);
    since.setHours(0, 0, 0, 0);

    const requestedIds = (dto.tableIds || []).filter(id => typeof id === 'string' && id.length);

    const tables = await this.customTableRepository.find({
      where: {
        workspaceId,
        ...(requestedIds.length ? { id: In(requestedIds) } : {}),
      },
      relations: { category: true },
      order: { updatedAt: 'DESC' },
    });

    if (requestedIds.length && tables.length !== requestedIds.length) {
      throw new BadRequestException(appError('TABLES_NOT_FOUND'));
    }

    if (!tables.length) {
      return {
        totals: { income: 0, expense: 0, net: 0, rows: 0 },
        timeseries: [],
        categories: [],
        counterparties: [],
        recent: [],
        tables: [],
      };
    }

    const tableById = new Map<string, CustomTable>();
    for (const t of tables) {
      tableById.set(t.id, t);
    }
    const tableIds = tables.map(t => t.id);

    const { mappingByTableId } = await loadTableColumns(this.customTableColumnRepository, tableIds);

    const rows = await this.customTableRowRepository.find({
      where: { tableId: In(tableIds), updatedAt: MoreThanOrEqual(since) },
      order: { updatedAt: 'DESC' },
    });

    const totals = { income: 0, expense: 0, net: 0, rows: 0 };
    const timeseriesMap = new Map<string, { income: number; expense: number }>();
    const categoryMap = new Map<string, { amount: number; rows: number }>();
    const counterpartyMap = new Map<string, { amount: number; rows: number }>();
    const perTableMap = new Map<string, { income: number; expense: number; rows: number }>();
    const recent: CustomTablesSummaryResponse['recent'] = [];

    for (const row of rows) {
      const table = tableById.get(row.tableId);
      if (!table) {
        continue;
      }
      const mapping = mappingByTableId.get(row.tableId);
      const dateValue = mapping?.dateKey ? row.data?.[mapping.dateKey] : null;
      const parsedDate = parseDate(dateValue) || row.updatedAt || row.createdAt;
      if (parsedDate < since) {
        continue;
      }

      const amountValue = mapping?.amountKey ? row.data?.[mapping.amountKey] : null;
      const amountRaw = parseNumber(amountValue);
      if (amountRaw === null) {
        continue;
      }

      const abs = Math.abs(amountRaw);
      const isIncome = amountRaw >= 0;
      const dateKey = toDateKey(parsedDate);
      const ts = timeseriesMap.get(dateKey) || { income: 0, expense: 0 };
      if (isIncome) {
        ts.income += abs;
        totals.income += abs;
      } else {
        ts.expense += abs;
        totals.expense += abs;
      }
      timeseriesMap.set(dateKey, ts);
      totals.rows += 1;

      const perTable = perTableMap.get(row.tableId) || { income: 0, expense: 0, rows: 0 };
      if (isIncome) {
        perTable.income += abs;
      } else {
        perTable.expense += abs;
      }
      perTable.rows += 1;
      perTableMap.set(row.tableId, perTable);

      const categoryValue = mapping?.categoryKey ? row.data?.[mapping.categoryKey] : null;
      const counterpartyValue = mapping?.counterpartyKey
        ? row.data?.[mapping.counterpartyKey]
        : null;
      const categoryName = normalizeText(categoryValue) || table.category?.name || null;
      const counterpartyName = normalizeText(counterpartyValue) || null;

      if (isIncome) {
        const key = (counterpartyName || 'Без названия').trim() || 'Без названия';
        const existing = counterpartyMap.get(key) || { amount: 0, rows: 0 };
        counterpartyMap.set(key, { amount: existing.amount + abs, rows: existing.rows + 1 });
      } else {
        const key =
          (categoryName || UNCATEGORIZED_CATEGORY_NAME).trim() || UNCATEGORIZED_CATEGORY_NAME;
        const existing = categoryMap.get(key) || { amount: 0, rows: 0 };
        categoryMap.set(key, { amount: existing.amount + abs, rows: existing.rows + 1 });
      }

      if (recent.length < 20) {
        recent.push({
          id: row.id,
          tableId: table.id,
          tableName: table.name,
          rowNumber: row.rowNumber,
          amount: isIncome ? abs : -abs,
          category: categoryName,
          counterparty: counterpartyName,
          updatedAt: (row.updatedAt || row.createdAt).toISOString(),
        });
      }
    }

    totals.net = totals.income - totals.expense;

    const timeseries = Array.from(timeseriesMap.entries())
      .map(([date, values]) => ({ date, ...values }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const categories = Array.from(categoryMap.entries())
      .map(([name, data]) => ({ name, amount: data.amount, rows: data.rows }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10);

    const counterparties = Array.from(counterpartyMap.entries())
      .map(([name, data]) => ({ name, amount: data.amount, rows: data.rows }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10);

    const tablesBreakdown = tables
      .map(t => {
        const metrics = perTableMap.get(t.id) || { income: 0, expense: 0, rows: 0 };
        return {
          id: t.id,
          name: t.name,
          income: metrics.income,
          expense: metrics.expense,
          net: metrics.income - metrics.expense,
          rows: metrics.rows,
        };
      })
      .sort((a, b) => b.rows - a.rows);

    const response: CustomTablesSummaryResponse = {
      totals,
      timeseries,
      categories,
      counterparties,
      recent,
      tables: tablesBreakdown,
    };

    await this.cacheManager.set(cacheKey, response, 300000); // 5 minutes
    return response;
  }

  async getAvailableCustomTables(workspaceId: string): Promise<AvailableCustomTable[]> {
    const tables = await this.customTableRepository.find({
      where: { workspaceId },
      order: { updatedAt: 'DESC' },
    });

    const results = [] as AvailableCustomTable[];

    for (const table of tables) {
      const rowCount = await this.customTableRowRepository.count({ where: { tableId: table.id } });
      results.push({
        id: table.id,
        name: table.name,
        source: table.source,
        rowCount,
      });
    }

    return results;
  }
}
