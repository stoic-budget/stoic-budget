import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { type Repository } from 'typeorm';
import { appError } from '../../common/errors/app-error';
import { currencyCodeOrDefault } from '../../common/utils/currency.util';
import { CustomTable } from '../../entities/custom-table.entity';
import { CustomTableRow } from '../../entities/custom-table-row.entity';
import { DataEntry, DataEntryType } from '../../entities/data-entry.entity';
import { CustomTableSupportService } from './custom-table-support.service';
import { DataEntryToCustomTableScope } from './dto/create-custom-table-from-data-entry.dto';
import { type DataEntryFieldKey, getDataEntryColumnMapping } from './helpers/data-entry-columns';
import { type RowInsertData } from './helpers/row-data';
import { throwHelpfulSchemaError } from './helpers/schema-error';

@Injectable()
export class CustomTableDataEntrySyncService {
  constructor(
    @InjectRepository(CustomTable)
    private readonly customTableRepository: Repository<CustomTable>,
    @InjectRepository(DataEntry)
    private readonly dataEntryRepository: Repository<DataEntry>,
    private readonly support: CustomTableSupportService,
  ) {}

  async syncFromDataEntry(
    userId: string,
    workspaceId: string,
    tableId: string,
  ): Promise<{ tableId: string; rowsCreated: number; syncedAt: Date }> {
    await this.support.ensureCanEditCustomTables(userId, workspaceId);
    let table: CustomTable | null = null;
    try {
      const qb = this.customTableRepository
        .createQueryBuilder('table')
        .leftJoinAndSelect('table.columns', 'columns')
        .where('table.id = :tableId', { tableId })
        .andWhere('table.workspaceId = :workspaceId', { workspaceId });

      table = await qb.getOne();
    } catch (error) {
      throwHelpfulSchemaError(error);
    }
    if (!table) {
      throw new NotFoundException(appError('TABLE_NOT_FOUND'));
    }

    const isCustomTab = Boolean(table.dataEntryCustomTabId);
    if (!(isCustomTab || table.dataEntryScope)) {
      throw new BadRequestException(appError('TABLE_NOT_LINKED_TO_DATA_ENTRY'));
    }

    let entries: DataEntry[];
    try {
      const qb = this.dataEntryRepository
        .createQueryBuilder('entry')
        .where('entry.workspaceId = :workspaceId', { workspaceId })
        .orderBy('entry.date', 'ASC')
        .addOrderBy('entry.createdAt', 'ASC');

      if (isCustomTab) {
        qb.andWhere('entry.customTabId = :customTabId', {
          customTabId: table.dataEntryCustomTabId,
        });
      } else if (table.dataEntryScope === DataEntryToCustomTableScope.TYPE) {
        if (!table.dataEntryType) {
          throw new BadRequestException(appError('SYNC_TYPE_REQUIRED'));
        }
        qb.andWhere('entry.type = :type', { type: table.dataEntryType });
      }

      entries = await qb.getMany();
    } catch (error) {
      throwHelpfulSchemaError(error);
    }

    const columns = (table.columns || []).sort((a, b) => a.position - b.position);
    const { fieldKeyByName, customFieldKeyByName } = getDataEntryColumnMapping(columns);

    const requiredFields: DataEntryFieldKey[] = ['date', 'amount', 'currency', 'note'];
    if (!isCustomTab && table.dataEntryScope === DataEntryToCustomTableScope.ALL) {
      requiredFields.push('type');
    }

    const missing = requiredFields.filter(field => !fieldKeyByName[field]);
    if (missing.length) {
      const labelByField: Record<DataEntryFieldKey, string> = {
        date: 'Дата',
        type: 'Тип',
        amount: 'Сумма',
        currency: 'Валюта',
        note: 'Комментарий',
      };
      const missingLabels = missing.map(field => labelByField[field]).join(', ');
      throw new BadRequestException(appError('SYNC_COLUMNS_NOT_FOUND', { columns: missingLabels }));
    }

    const typeLabels: Record<DataEntryType, string> = {
      [DataEntryType.CASH]: 'Наличные',
      [DataEntryType.RAW]: 'Сырьё',
      [DataEntryType.DEBIT]: 'Дебет',
      [DataEntryType.CREDIT]: 'Кредит',
    };

    const rowsToInsert = entries.map((entry, idx) => {
      const data: RowInsertData = {};
      const dateKey = fieldKeyByName.date;
      const amountKey = fieldKeyByName.amount;
      const currencyKey = fieldKeyByName.currency;
      const noteKey = fieldKeyByName.note;
      const typeKey = fieldKeyByName.type;

      if (dateKey) {
        data[dateKey] = entry.date;
      }
      if (amountKey) {
        data[amountKey] = entry.amount;
      }
      if (currencyKey) {
        data[currencyKey] = currencyCodeOrDefault(entry.currency);
      }
      if (noteKey) {
        data[noteKey] = entry.note || null;
      }

      if (!isCustomTab && table.dataEntryScope === DataEntryToCustomTableScope.ALL && typeKey) {
        data[typeKey] = typeLabels[entry.type] || entry.type;
      }

      const customName = entry.customFieldName?.trim();
      if (customName) {
        const customKey = customFieldKeyByName.get(customName);
        if (customKey) {
          data[customKey] = entry.customFieldValue ?? null;
        }
      }

      return {
        tableId: table.id,
        rowNumber: idx + 1,
        data,
      };
    });

    const syncedAt = new Date();
    const createdRows: CustomTableRow[] = [];
    await this.customTableRepository.manager.transaction(async manager => {
      await manager.delete(CustomTableRow, { tableId: table.id });
      const chunkSize = 500;
      for (let i = 0; i < rowsToInsert.length; i += chunkSize) {
        const chunk = rowsToInsert.slice(i, i + chunkSize);
        if (chunk.length) {
          const savedChunk = await manager.save(CustomTableRow, chunk);
          createdRows.push(...savedChunk);
        }
      }
      await manager.update(CustomTable, { id: table.id }, { dataEntrySyncedAt: syncedAt });
    });

    await this.support.logRowBatchCreate({
      userId,
      workspaceId,
      tableId: table.id,
      rows: createdRows,
      meta: {
        rowsCreated: rowsToInsert.length,
        source: 'data_entry_sync',
      },
    });

    await this.support.recalcAfterWrite(table.id, workspaceId);
    return { tableId: table.id, rowsCreated: rowsToInsert.length, syncedAt };
  }
}
