import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Cache } from 'cache-manager';
import { In, type Repository } from 'typeorm';
import { appError } from '../../common/errors/app-error';
import type { CustomTablesReportBody } from '../../contracts';
import { CustomTable } from '../../entities/custom-table.entity';
import { CustomTableColumn } from '../../entities/custom-table-column.entity';
import { CustomTableRow } from '../../entities/custom-table-row.entity';
import {
  CustomTableReportFlowType,
  CustomTableReportSortKey,
} from './dto/custom-tables-report.dto';
import { loadTableColumns } from './helpers/custom-table-columns.loader';
import { rowCurrency } from './helpers/custom-table-columns.util';
import {
  aggregateCustomTablesReport,
  type CustomTableReportRecord,
  emptyCustomTablesReportResponse,
} from './helpers/custom-tables-aggregate.util';
import { getReportsVersion } from './helpers/report-query.util';
import { normalizeText, parseDate, parseNumber, toDateKey } from './helpers/report-values.util';
import type { CustomTablesReportResponse } from './interfaces/custom-tables-report.interface';

/**
 * Custom-table rows per counterparty over the last `days`, compared with the
 * period of the same length before it.
 */
@Injectable()
export class CustomTablesReport {
  constructor(
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    @InjectRepository(CustomTable)
    private readonly customTableRepository: Repository<CustomTable>,
    @InjectRepository(CustomTableColumn)
    private readonly customTableColumnRepository: Repository<CustomTableColumn>,
    @InjectRepository(CustomTableRow)
    private readonly customTableRowRepository: Repository<CustomTableRow>,
  ) {}

  async getCustomTablesReport(
    workspaceId: string,
    dto: CustomTablesReportBody,
  ): Promise<CustomTablesReportResponse> {
    const version = await getReportsVersion(this.cacheManager, workspaceId);
    const cacheKey = `reports:custom-tables-report:${workspaceId}:${version}:${JSON.stringify(dto)}`;
    const cached = await this.cacheManager.get<CustomTablesReportResponse>(cacheKey);
    if (cached) {
      return cached;
    }

    const safeDays =
      Number.isFinite(dto.days) && (dto.days as number) > 0
        ? Math.min(dto.days as number, 3650)
        : 30;
    const flowType = dto.flowType || CustomTableReportFlowType.ALL;
    const sortBy = dto.sortBy || CustomTableReportSortKey.AMOUNT;
    const limit =
      Number.isFinite(dto.limit) && (dto.limit as number) > 0
        ? Math.min(dto.limit as number, 500)
        : 60;
    const search = normalizeText(dto.search)?.toLowerCase() || null;

    const since = new Date();
    since.setDate(since.getDate() - safeDays);
    since.setHours(0, 0, 0, 0);

    const previousSince = new Date(since);
    previousSince.setDate(previousSince.getDate() - safeDays);

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
      return emptyCustomTablesReportResponse();
    }

    const tableById = new Map<string, CustomTable>();
    for (const table of tables) {
      tableById.set(table.id, table);
    }
    const tableIds = tables.map(table => table.id);

    const { columnsByTableId, mappingByTableId } = await loadTableColumns(
      this.customTableColumnRepository,
      tableIds,
    );

    const currentRows = await this.customTableRowRepository
      .createQueryBuilder('row')
      .where('row.tableId IN (:...tableIds)', { tableIds })
      .andWhere('row.updatedAt >= :since', { since })
      .getMany();

    const previousRows = await this.customTableRowRepository
      .createQueryBuilder('row')
      .where('row.tableId IN (:...tableIds)', { tableIds })
      .andWhere('row.updatedAt >= :previousSince', { previousSince })
      .andWhere('row.updatedAt < :since', { since })
      .getMany();

    const toRecord = (row: CustomTableRow): CustomTableReportRecord | null => {
      const table = tableById.get(row.tableId);
      const mapping = mappingByTableId.get(row.tableId);
      if (!(table && mapping?.amountKey)) {
        return null;
      }

      const rawAmount = parseNumber(row.data?.[mapping.amountKey]);
      if (rawAmount === null) {
        return null;
      }

      const flow: 'expense' | 'income' = rawAmount < 0 ? 'expense' : 'income';
      if (flowType === CustomTableReportFlowType.EXPENSE && flow !== 'expense') {
        return null;
      }
      if (flowType === CustomTableReportFlowType.INCOME && flow !== 'income') {
        return null;
      }

      const counterparty =
        normalizeText(mapping.counterpartyKey ? row.data?.[mapping.counterpartyKey] : null) ||
        'Unknown';
      const category = normalizeText(mapping.categoryKey ? row.data?.[mapping.categoryKey] : null);
      const parsedDate = mapping.dateKey
        ? parseDate(row.data?.[mapping.dateKey]) || row.updatedAt || row.createdAt
        : row.updatedAt || row.createdAt;
      const date = parsedDate ? toDateKey(parsedDate) : null;
      const currency = rowCurrency(columnsByTableId.get(row.tableId) || [], row);

      if (
        search &&
        !counterparty.toLowerCase().includes(search) &&
        !(category || '').toLowerCase().includes(search) &&
        !table.name.toLowerCase().includes(search)
      ) {
        return null;
      }

      return {
        rowId: row.id,
        tableId: row.tableId,
        tableName: table.name,
        source: table.source,
        counterparty,
        amount: Math.abs(rawAmount),
        date,
        category,
        currency,
        flow,
      };
    };

    const records = currentRows.map(toRecord).filter(Boolean) as CustomTableReportRecord[];
    const previousRecords = previousRows.map(toRecord).filter(Boolean) as CustomTableReportRecord[];

    const response = aggregateCustomTablesReport(tables, records, previousRecords, sortBy, limit);

    await this.cacheManager.set(cacheKey, response, 300000);
    return response;
  }
}
