import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { type Repository } from 'typeorm';
import { appError } from '../../common/errors/app-error';
import { currencyCodeOrDefault } from '../../common/utils/currency.util';
import type { CreateCustomTableFromDataEntryCustomTabBody } from '../../contracts';
import { AuditAction, EntityType } from '../../entities/audit-event.entity';
import { CustomTable, CustomTableSource } from '../../entities/custom-table.entity';
import {
  CustomTableColumn,
  CustomTableColumnType,
} from '../../entities/custom-table-column.entity';
import { CustomTableRow } from '../../entities/custom-table-row.entity';
import { DataEntry } from '../../entities/data-entry.entity';
import { DataEntryCustomField } from '../../entities/data-entry-custom-field.entity';
import { CustomTableSupportService } from './custom-table-support.service';
import { type ColumnDefinitionConfig, type RowInsertData } from './helpers/row-data';
import { throwHelpfulSchemaError } from './helpers/schema-error';
import { generateColumnKey } from './helpers/source-columns';

@Injectable()
export class CustomTableFromDataEntryTabService {
  constructor(
    @InjectRepository(CustomTable)
    private readonly customTableRepository: Repository<CustomTable>,
    @InjectRepository(CustomTableColumn)
    private readonly customTableColumnRepository: Repository<CustomTableColumn>,
    @InjectRepository(CustomTableRow)
    private readonly customTableRowRepository: Repository<CustomTableRow>,
    @InjectRepository(DataEntry)
    private readonly dataEntryRepository: Repository<DataEntry>,
    @InjectRepository(DataEntryCustomField)
    private readonly dataEntryCustomFieldRepository: Repository<DataEntryCustomField>,
    private readonly support: CustomTableSupportService,
  ) {}

  async createFromDataEntryCustomTab(
    userId: string,
    workspaceId: string,
    dto: CreateCustomTableFromDataEntryCustomTabBody,
  ): Promise<{ tableId: string; columnsCreated: number; rowsCreated: number }> {
    await this.support.ensureCanEditCustomTables(userId, workspaceId);
    let customTab: DataEntryCustomField | null = null;
    try {
      const qb = this.dataEntryCustomFieldRepository
        .createQueryBuilder('customField')
        .where('customField.id = :id', { id: dto.customTabId })
        .andWhere('customField.workspaceId = :workspaceId', { workspaceId });

      customTab = await qb.getOne();
    } catch (error) {
      throwHelpfulSchemaError(error);
    }
    if (!customTab) {
      throw new BadRequestException(appError('VIEW_NOT_FOUND'));
    }

    let entries: DataEntry[];
    try {
      const qb = this.dataEntryRepository
        .createQueryBuilder('entry')
        .where('entry.customTabId = :customTabId', { customTabId: customTab.id })
        .andWhere('entry.workspaceId = :workspaceId', { workspaceId })
        .orderBy('entry.date', 'ASC')
        .addOrderBy('entry.createdAt', 'ASC');

      entries = await qb.getMany();
    } catch (error) {
      throwHelpfulSchemaError(error);
    }

    if (!entries.length) {
      throw new BadRequestException(appError('VIEW_EMPTY'));
    }

    const tableName = (dto.name?.trim() || customTab.name).slice(0, 120);
    const description = dto.description === undefined ? null : dto.description;

    let table: CustomTable;
    try {
      table = await this.customTableRepository.save(
        this.customTableRepository.create({
          userId,
          workspaceId,
          name: tableName,
          description,
          source: CustomTableSource.MANUAL,
          categoryId: null,
          dataEntryScope: null,
          dataEntryType: null,
          dataEntryCustomTabId: customTab.id,
          dataEntrySyncedAt: new Date(),
        }),
      );
    } catch (error) {
      throwHelpfulSchemaError(error);
    }

    await this.support.logEvent({
      userId,
      workspaceId,
      entityType: EntityType.CUSTOM_TABLE,
      entityId: table.id,
      action: AuditAction.CREATE,
      diff: { before: null, after: table },
      meta: {
        source: 'data_entry_custom_tab_export',
        customTabId: customTab.id,
        rowsPlanned: entries.length,
      },
    });

    const columnDefs: Array<{
      id: string;
      title: string;
      type: CustomTableColumnType;
      config?: ColumnDefinitionConfig;
    }> = [
      {
        id: 'date',
        title: 'Дата',
        type: CustomTableColumnType.DATE,
        config: {
          source: {
            kind: 'data_entry_custom_tab',
            customTabId: customTab.id,
            field: 'date',
          },
        },
      },
      {
        id: 'amount',
        title: 'Сумма',
        type: CustomTableColumnType.NUMBER,
        config: {
          source: {
            kind: 'data_entry_custom_tab',
            customTabId: customTab.id,
            field: 'amount',
          },
        },
      },
      {
        id: 'currency',
        title: 'Валюта',
        type: CustomTableColumnType.TEXT,
        config: {
          source: {
            kind: 'data_entry_custom_tab',
            customTabId: customTab.id,
            field: 'currency',
          },
        },
      },
      {
        id: 'note',
        title: 'Комментарий',
        type: CustomTableColumnType.TEXT,
        config: {
          source: {
            kind: 'data_entry_custom_tab',
            customTabId: customTab.id,
            field: 'note',
          },
        },
      },
    ];

    let createdColumns: CustomTableColumn[];
    try {
      createdColumns = await this.customTableColumnRepository.save(
        columnDefs.map((def, position) =>
          this.customTableColumnRepository.create({
            tableId: table.id,
            key: generateColumnKey(),
            title: def.title,
            type: def.type,
            isRequired: false,
            isUnique: false,
            position,
            config: def.config ?? null,
          }),
        ),
      );
    } catch (error) {
      throwHelpfulSchemaError(error);
    }

    const keyByDefId = new Map<string, string>();
    for (let i = 0; i < createdColumns.length; i += 1) {
      const def = columnDefs[i];
      const col = createdColumns[i];
      if (def && col) {
        keyByDefId.set(def.id, col.key);
      }
    }

    const dateKey = keyByDefId.get('date');
    const amountKey = keyByDefId.get('amount');
    const currencyKey = keyByDefId.get('currency');
    const noteKey = keyByDefId.get('note');

    if (!(dateKey && amountKey && currencyKey && noteKey)) {
      throw new BadRequestException(appError('TABLE_COLUMNS_BUILD_FAILED'));
    }

    const rowsToInsert = entries.map((entry, idx) => {
      const data: RowInsertData = {};
      data[dateKey] = entry.date;
      data[amountKey] = entry.amount;
      data[currencyKey] = currencyCodeOrDefault(entry.currency);
      data[noteKey] = entry.note || null;
      return this.customTableRowRepository.create({
        tableId: table.id,
        rowNumber: idx + 1,
        data,
      });
    });

    const chunkSize = 500;
    for (let i = 0; i < rowsToInsert.length; i += chunkSize) {
      const chunk = rowsToInsert.slice(i, i + chunkSize);
      try {
        await this.customTableRowRepository.save(chunk);
      } catch (error) {
        throwHelpfulSchemaError(error);
      }
    }

    await this.support.logRowBatchCreate({
      userId,
      workspaceId,
      tableId: table.id,
      rows: rowsToInsert,
      meta: {
        rowsCreated: rowsToInsert.length,
        source: 'data_entry_custom_tab_export',
        customTabId: customTab.id,
      },
    });

    return {
      tableId: table.id,
      columnsCreated: createdColumns.length,
      rowsCreated: rowsToInsert.length,
    };
  }
}
