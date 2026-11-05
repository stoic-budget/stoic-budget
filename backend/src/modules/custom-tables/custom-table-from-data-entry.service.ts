import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { type Repository } from 'typeorm';
import { toEnum } from '../../common/effect/to-enum';
import { appError } from '../../common/errors/app-error';
import { currencyCodeOrDefault } from '../../common/utils/currency.util';
import type { CreateCustomTableFromDataEntryBody } from '../../contracts';
import { AuditAction, EntityType } from '../../entities/audit-event.entity';
import { CustomTable, CustomTableSource } from '../../entities/custom-table.entity';
import {
  CustomTableColumn,
  CustomTableColumnType,
} from '../../entities/custom-table-column.entity';
import { CustomTableRow } from '../../entities/custom-table-row.entity';
import { DataEntry, DataEntryType } from '../../entities/data-entry.entity';
import { CustomTableSupportService } from './custom-table-support.service';
import { DataEntryToCustomTableScope } from './dto/create-custom-table-from-data-entry.dto';
import { type ColumnDefinitionConfig, type RowInsertData } from './helpers/row-data';
import { throwHelpfulSchemaError } from './helpers/schema-error';
import { generateColumnKey } from './helpers/source-columns';

@Injectable()
export class CustomTableFromDataEntryService {
  constructor(
    @InjectRepository(CustomTable)
    private readonly customTableRepository: Repository<CustomTable>,
    @InjectRepository(CustomTableColumn)
    private readonly customTableColumnRepository: Repository<CustomTableColumn>,
    @InjectRepository(CustomTableRow)
    private readonly customTableRowRepository: Repository<CustomTableRow>,
    @InjectRepository(DataEntry)
    private readonly dataEntryRepository: Repository<DataEntry>,
    private readonly support: CustomTableSupportService,
  ) {}

  async createFromDataEntry(
    userId: string,
    workspaceId: string,
    dto: CreateCustomTableFromDataEntryBody,
  ): Promise<{ tableId: string; columnsCreated: number; rowsCreated: number }> {
    await this.support.ensureCanEditCustomTables(userId, workspaceId);
    const selectedType =
      dto.scope === DataEntryToCustomTableScope.TYPE ? toEnum(DataEntryType, dto.type) : undefined;

    let entries: DataEntry[];
    try {
      const qb = this.dataEntryRepository
        .createQueryBuilder('entry')
        .where('entry.workspaceId = :workspaceId', { workspaceId })
        .orderBy('entry.date', 'ASC')
        .addOrderBy('entry.createdAt', 'ASC');

      if (selectedType) {
        qb.andWhere('entry.type = :type', { type: selectedType });
      }

      entries = await qb.getMany();
    } catch (error) {
      throwHelpfulSchemaError(error);
    }

    if (!entries.length) {
      throw new BadRequestException(appError('DATA_ENTRY_EMPTY'));
    }

    const typeLabels: Record<DataEntryType, string> = {
      [DataEntryType.CASH]: 'Наличные',
      [DataEntryType.RAW]: 'Сырьё',
      [DataEntryType.DEBIT]: 'Дебет',
      [DataEntryType.CREDIT]: 'Кредит',
    };

    const defaultName = selectedType
      ? `Ввод данных — ${typeLabels[selectedType] || selectedType}`
      : 'Ввод данных — все';
    const tableName = dto.name?.trim() || defaultName;
    const description = dto.description === undefined ? null : dto.description;

    const customFieldMetaByName = new Map<string, { icon: string | null }>();
    for (const entry of entries) {
      const name = entry.customFieldName?.trim();
      if (!name) {
        continue;
      }
      const icon = entry.customFieldIcon?.trim() || null;
      const existing = customFieldMetaByName.get(name);
      if (!existing) {
        customFieldMetaByName.set(name, { icon });
      } else if (!existing.icon && icon) {
        existing.icon = icon;
      }
    }

    const maxCustomColumns = 50;
    if (customFieldMetaByName.size > maxCustomColumns) {
      throw new BadRequestException(
        appError('TOO_MANY_CUSTOM_COLUMNS', {
          count: customFieldMetaByName.size,
          limit: maxCustomColumns,
        }),
      );
    }

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
        config: { source: { kind: 'data_entry_field', field: 'date' } },
      },
      ...(dto.scope === DataEntryToCustomTableScope.ALL
        ? [
            {
              id: 'type',
              title: 'Тип',
              type: CustomTableColumnType.TEXT,
              config: { source: { kind: 'data_entry_field', field: 'type' } },
            },
          ]
        : []),
      {
        id: 'amount',
        title: 'Сумма',
        type: CustomTableColumnType.NUMBER,
        config: { source: { kind: 'data_entry_field', field: 'amount' } },
      },
      {
        id: 'currency',
        title: 'Валюта',
        type: CustomTableColumnType.TEXT,
        config: { source: { kind: 'data_entry_field', field: 'currency' } },
      },
      {
        id: 'note',
        title: 'Комментарий',
        type: CustomTableColumnType.TEXT,
        config: { source: { kind: 'data_entry_field', field: 'note' } },
      },
    ];

    const customNames = Array.from(customFieldMetaByName.keys()).sort((a, b) =>
      a.localeCompare(b, 'ru'),
    );
    for (const name of customNames) {
      const meta = customFieldMetaByName.get(name);
      columnDefs.push({
        id: `custom:${name}`,
        title: name,
        type: CustomTableColumnType.TEXT,
        config: {
          ...(meta?.icon ? { icon: meta.icon } : {}),
          source: { kind: 'data_entry_custom_field', name },
        },
      });
    }

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
          dataEntryScope: dto.scope,
          dataEntryType: selectedType || null,
          dataEntryCustomTabId: null,
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
        source: 'data_entry_export',
        scope: dto.scope,
        type: selectedType || null,
        rowsPlanned: entries.length,
        customColumns: customNames.length,
      },
    });

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

    const customKeyByName = new Map<string, string>();
    for (const name of customNames) {
      const key = keyByDefId.get(`custom:${name}`);
      if (key) {
        customKeyByName.set(name, key);
      }
    }

    const dateKey = keyByDefId.get('date');
    const typeKey = keyByDefId.get('type');
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

      if (dto.scope === DataEntryToCustomTableScope.ALL && typeKey) {
        data[typeKey] = typeLabels[entry.type] || entry.type;
      }

      const customName = entry.customFieldName?.trim();
      const customValue = entry.customFieldValue ?? null;
      if (customName && customValue !== null) {
        const key = customKeyByName.get(customName);
        if (key) {
          data[key] = customValue;
        }
      }

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
        scope: dto.scope,
        type: selectedType || null,
      },
    });

    return {
      tableId: table.id,
      columnsCreated: createdColumns.length,
      rowsCreated: rowsToInsert.length,
    };
  }
}
