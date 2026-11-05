import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, type Repository } from 'typeorm';
import type { ClassifyPaidStatusBody } from '../../contracts';
import { CustomTableColumn } from '../../entities/custom-table-column.entity';
import { CustomTableRow } from '../../entities/custom-table-row.entity';
import { CustomTableSupportService } from './custom-table-support.service';
import { detectPaidStatus, type PaidStatusInput } from './helpers/paid-status.helper';
import { collectRowText, getPaidStatusFieldKeys, isUuid } from './helpers/row-data';
import { throwHelpfulSchemaError } from './helpers/schema-error';

@Injectable()
export class CustomTablePaidStatusService {
  constructor(
    @InjectRepository(CustomTableColumn)
    private readonly customTableColumnRepository: Repository<CustomTableColumn>,
    @InjectRepository(CustomTableRow)
    private readonly customTableRowRepository: Repository<CustomTableRow>,
    private readonly support: CustomTableSupportService,
  ) {}

  async classifyPaidStatus(
    workspaceId: string,
    tableId: string,
    dto: ClassifyPaidStatusBody,
  ): Promise<{ items: Array<{ rowId: string; paid: boolean | null }> }> {
    await this.support.requireTable(workspaceId, tableId);
    const rowIds = Array.isArray(dto.rowIds) ? dto.rowIds.filter(Boolean) : [];
    const uniqueRowIds = Array.from(new Set(rowIds));
    if (!uniqueRowIds.length) {
      return { items: [] };
    }
    const validRowIds = uniqueRowIds.filter(rowId => isUuid(rowId));
    if (!validRowIds.length) {
      return {
        items: uniqueRowIds.map(rowId => ({ rowId, paid: null })),
      };
    }

    let rows: CustomTableRow[] = [];
    let columns: CustomTableColumn[] = [];
    try {
      rows = await this.customTableRowRepository.find({
        where: { tableId, id: In(validRowIds) },
        select: {
          id: true,
          data: true,
        },
      });
      columns = await this.customTableColumnRepository.find({
        where: { tableId },
        select: {
          key: true,
          title: true,
        },
      });
    } catch (error) {
      throwHelpfulSchemaError(error);
    }

    const { commentKeys, counterpartyKeys } = getPaidStatusFieldKeys(columns);
    const inputs: PaidStatusInput[] = rows.map(row => {
      const data = row.data || {};
      let comment = collectRowText(data, commentKeys);
      const counterparty = collectRowText(data, counterpartyKeys);
      if (!(comment || counterparty)) {
        const fallbackKeys = Object.keys(data);
        comment = collectRowText(data, fallbackKeys);
      }
      return {
        id: row.id,
        comment: comment || null,
        counterparty: counterparty || null,
      };
    });

    const byId = new Map<string, boolean | null>(
      inputs.map(input => [input.id, detectPaidStatus(input)]),
    );
    const items = uniqueRowIds.map(rowId => ({
      rowId,
      paid: byId.has(rowId) ? (byId.get(rowId) as boolean | null) : null,
    }));
    return { items };
  }
}
