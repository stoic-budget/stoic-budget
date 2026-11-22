import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, type Repository } from 'typeorm';
import type { CustomTablesReportDrillDownBody } from '../../contracts';
import { CustomTable } from '../../entities/custom-table.entity';
import { CustomTableColumn } from '../../entities/custom-table-column.entity';
import { CustomTableRow } from '../../entities/custom-table-row.entity';
import { CustomTableReportFlowType } from './dto/custom-tables-report.dto';
import { loadTableColumns } from './helpers/custom-table-columns.loader';
import { rowCurrency } from './helpers/custom-table-columns.util';
import { normalizeText, parseDate, parseNumber, toDateKey } from './helpers/report-values.util';
import type { CustomTablesReportDrillDownResponse } from './interfaces/custom-tables-report.interface';

/** The rows behind one counterparty line of the custom tables report, newest first. */
@Injectable()
export class CustomTablesDrillDownReport {
  constructor(
    @InjectRepository(CustomTable)
    private readonly customTableRepository: Repository<CustomTable>,
    @InjectRepository(CustomTableColumn)
    private readonly customTableColumnRepository: Repository<CustomTableColumn>,
    @InjectRepository(CustomTableRow)
    private readonly customTableRowRepository: Repository<CustomTableRow>,
  ) {}

  async getCustomTablesReportDrillDown(
    workspaceId: string,
    dto: CustomTablesReportDrillDownBody,
  ): Promise<CustomTablesReportDrillDownResponse> {
    const safeDays =
      Number.isFinite(dto.days) && (dto.days as number) > 0
        ? Math.min(dto.days as number, 3650)
        : 30;
    const flowType = dto.flowType || CustomTableReportFlowType.ALL;
    const limit =
      Number.isFinite(dto.limit) && (dto.limit as number) > 0
        ? Math.min(dto.limit as number, 200)
        : 120;

    const since = new Date();
    since.setDate(since.getDate() - safeDays);
    since.setHours(0, 0, 0, 0);

    const requestedIds = (dto.tableIds || []).filter(id => typeof id === 'string' && id.length);
    const tables = await this.customTableRepository.find({
      where: {
        workspaceId,
        ...(requestedIds.length ? { id: In(requestedIds) } : {}),
      },
      order: { updatedAt: 'DESC' },
    });

    if (!tables.length) {
      return { counterparty: dto.counterparty, items: [] };
    }

    const tableIds = tables.map(table => table.id);
    const tableById = new Map(tables.map(table => [table.id, table]));
    const { columnsByTableId, mappingByTableId } = await loadTableColumns(
      this.customTableColumnRepository,
      tableIds,
    );

    const rows = await this.customTableRowRepository
      .createQueryBuilder('row')
      .where('row.tableId IN (:...tableIds)', { tableIds })
      .andWhere('row.updatedAt >= :since', { since })
      .getMany();

    const items: CustomTablesReportDrillDownResponse['items'] = [];
    const needle = dto.counterparty.trim().toLowerCase();

    for (const row of rows) {
      const table = tableById.get(row.tableId);
      const mapping = mappingByTableId.get(row.tableId);
      if (!(table && mapping?.amountKey)) {
        continue;
      }

      const rawAmount = parseNumber(row.data?.[mapping.amountKey]);
      if (rawAmount === null) {
        continue;
      }

      const flow: 'expense' | 'income' = rawAmount < 0 ? 'expense' : 'income';
      if (flowType === CustomTableReportFlowType.EXPENSE && flow !== 'expense') {
        continue;
      }
      if (flowType === CustomTableReportFlowType.INCOME && flow !== 'income') {
        continue;
      }

      const counterparty =
        normalizeText(mapping.counterpartyKey ? row.data?.[mapping.counterpartyKey] : null) ||
        'Unknown';
      if (counterparty.toLowerCase() !== needle) {
        continue;
      }

      const category = normalizeText(mapping.categoryKey ? row.data?.[mapping.categoryKey] : null);
      const parsedDate = mapping.dateKey
        ? parseDate(row.data?.[mapping.dateKey]) || row.updatedAt || row.createdAt
        : row.updatedAt || row.createdAt;

      const currency = rowCurrency(columnsByTableId.get(row.tableId) || [], row);

      items.push({
        rowId: row.id,
        tableId: row.tableId,
        tableName: table.name,
        source: table.source,
        date: parsedDate ? toDateKey(parsedDate) : null,
        amount: Math.abs(rawAmount),
        category,
        currency,
      });
    }

    items.sort((a, b) => {
      const left = a.date || '';
      const right = b.date || '';
      return right.localeCompare(left);
    });

    return {
      counterparty: dto.counterparty,
      items: items.slice(0, limit),
    };
  }
}
