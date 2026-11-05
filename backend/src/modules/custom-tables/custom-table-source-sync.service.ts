import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Not, type QueryDeepPartialEntity, type Repository } from 'typeorm';
import { appError } from '../../common/errors/app-error';
import { MAX_SOURCE_STATEMENTS } from '../../contracts';
import { AuditAction, EntityType } from '../../entities/audit-event.entity';
import { CustomTable } from '../../entities/custom-table.entity';
import { CustomTableColumn } from '../../entities/custom-table-column.entity';
import { CustomTableRow } from '../../entities/custom-table-row.entity';
import { Statement } from '../../entities/statement.entity';
import { CustomTableSupportService } from './custom-table-support.service';
import { sameCellValue, toRowDataRecord } from './helpers/row-data';
import { throwHelpfulSchemaError } from './helpers/schema-error';
import { columnSourceConfig, newSourceColumns, sourceFields } from './helpers/source-columns';
import { fetchSourceRows } from './helpers/source-rows';
import type { SourceAdapter, SourceFilters, SourceRow, SourceValue } from './sources/source.types';

@Injectable()
export class CustomTableSourceSyncService {
  constructor(
    @InjectRepository(CustomTable)
    private readonly customTableRepository: Repository<CustomTable>,
    @InjectRepository(CustomTableColumn)
    private readonly customTableColumnRepository: Repository<CustomTableColumn>,
    @InjectRepository(CustomTableRow)
    private readonly customTableRowRepository: Repository<CustomTableRow>,
    @InjectRepository(Statement)
    private readonly statementRepository: Repository<Statement>,
    private readonly support: CustomTableSupportService,
  ) {}

  async refreshFromSource(
    userId: string,
    workspaceId: string,
    tableId: string,
  ): Promise<{
    tableId: string;
    inserted: number;
    updated: number;
    unchanged: number;
    total: number;
    syncedAt: string;
  }> {
    await this.support.ensureCanEditCustomTables(userId, workspaceId);
    let table: CustomTable | null = null;
    try {
      table = await this.customTableRepository
        .createQueryBuilder('table')
        .leftJoinAndSelect('table.columns', 'columns')
        .where('table.id = :tableId', { tableId })
        .andWhere('table.workspaceId = :workspaceId', { workspaceId })
        .getOne();
    } catch (error) {
      throwHelpfulSchemaError(error);
    }
    if (!table) {
      throw new NotFoundException(appError('TABLE_NOT_FOUND'));
    }
    const binding = table.sourceBinding;
    if (!binding?.kind) {
      throw new BadRequestException(appError('TABLE_NOT_LINKED_TO_SOURCE'));
    }
    const adapter = this.support.requireSources().get(binding.kind);
    const sourceRows = await fetchSourceRows(
      adapter,
      workspaceId,
      (binding.filters ?? {}) as SourceFilters,
    );
    const columns = await this.addNewSourceColumns(table, adapter);
    table.sourceBinding = { ...binding, fields: sourceFields(adapter) };
    const result = await this.applySourceRows({ userId, workspaceId, table, columns, sourceRows });
    await this.support.logEvent({
      userId,
      workspaceId,
      entityType: EntityType.CUSTOM_TABLE,
      entityId: table.id,
      action: AuditAction.UPDATE,
      meta: {
        source: 'app_source_refresh',
        kind: binding.kind,
        inserted: result.inserted,
        updated: result.updated,
        unchanged: result.unchanged,
      },
    });
    return { tableId: table.id, ...result };
  }

  /**
   * Adds documents to a table built from documents' transactions, then
   * refreshes it. Only such a table qualifies: on one bound to a date range or
   * to picked records, a document filter would narrow the table instead of
   * growing it. Ids already in the binding are kept once, so a repeat is a no-op.
   */
  async addSourceStatements(
    userId: string,
    workspaceId: string,
    tableId: string,
    statementIds: readonly string[],
  ): ReturnType<CustomTableSourceSyncService['refreshFromSource']> {
    await this.support.ensureCanEditCustomTables(userId, workspaceId);
    const table = await this.customTableRepository.findOne({ where: { id: tableId, workspaceId } });
    if (!table) {
      throw new NotFoundException(appError('TABLE_NOT_FOUND'));
    }
    const binding = table.sourceBinding;
    const current = binding?.filters?.statementIds;
    if (binding?.kind !== 'transactions' || !Array.isArray(current) || binding.filters?.ids) {
      throw new BadRequestException(appError('SOURCE_NOT_DOCUMENTS'));
    }
    const requested = [...new Set(statementIds)];
    const found = await this.statementRepository.count({
      where: { id: In(requested), workspaceId, deletedAt: IsNull() },
    });
    if (found !== requested.length) {
      throw new NotFoundException(appError('STATEMENT_NOT_FOUND'));
    }
    const merged = [...new Set([...current.map(String), ...requested])];
    if (merged.length > MAX_SOURCE_STATEMENTS) {
      throw new BadRequestException(
        appError('SOURCE_TOO_MANY_DOCUMENTS', { limit: MAX_SOURCE_STATEMENTS }),
      );
    }
    await this.customTableRepository.update(
      { id: table.id, workspaceId },
      { sourceBinding: { ...binding, filters: { ...binding.filters, statementIds: merged } } },
    );
    return this.refreshFromSource(userId, workspaceId, table.id);
  }

  /** Adds a column for each field the source gained since the table was made. */
  private async addNewSourceColumns(
    table: CustomTable,
    adapter: SourceAdapter,
  ): Promise<CustomTableColumn[]> {
    const existing = table.columns ?? [];
    const drafts = newSourceColumns(table, adapter);
    if (!drafts.length) {
      return existing;
    }
    try {
      const created = await this.customTableColumnRepository.save(
        drafts.map(draft => this.customTableColumnRepository.create(draft)),
      );
      return [...existing, ...created];
    } catch (error) {
      throwHelpfulSchemaError(error);
    }
  }

  /**
   * Upsert by sourceKey. Only columns bound to a source field are written
   * (jsonb `||` patch), so user columns, styles, comments and row ids survive
   * a refresh. Rows whose source record disappeared are left in place.
   */
  async applySourceRows(params: {
    userId: string;
    workspaceId: string;
    table: CustomTable;
    columns: CustomTableColumn[];
    sourceRows: SourceRow[];
  }): Promise<{
    inserted: number;
    updated: number;
    unchanged: number;
    total: number;
    syncedAt: string;
  }> {
    const { table, sourceRows } = params;
    const keyByField = new Map<string, string>();
    for (const column of params.columns) {
      const source = columnSourceConfig(column.config);
      if (source?.kind === 'app_field' && source.field) {
        keyByField.set(source.field, column.key);
      }
    }
    if (!keyByField.size) {
      throw new BadRequestException(appError('SOURCE_COLUMNS_NOT_FOUND'));
    }

    let existing: CustomTableRow[] = [];
    try {
      existing = await this.customTableRowRepository.find({
        where: { tableId: table.id, sourceKey: Not(IsNull()) },
        select: {
          id: true,
          sourceKey: true,
          data: true,
        },
      });
    } catch (error) {
      throwHelpfulSchemaError(error);
    }
    const existingByKey = new Map<string, CustomTableRow>();
    for (const row of existing) {
      if (row.sourceKey) {
        existingByKey.set(row.sourceKey, row);
      }
    }

    const toInsert: CustomTableRow[] = [];
    const toUpdate: Array<{ id: string; patch: Record<string, SourceValue> }> = [];
    let unchanged = 0;
    let nextRowNumber = await this.support.getNextRowNumber(table.id);
    for (const sourceRow of sourceRows) {
      const patch: Record<string, SourceValue> = {};
      for (const [field, key] of keyByField) {
        if (field in sourceRow.values) {
          patch[key] = sourceRow.values[field] ?? null;
        }
      }
      const current = existingByKey.get(sourceRow.sourceKey);
      if (!current) {
        toInsert.push(
          this.customTableRowRepository.create({
            tableId: table.id,
            rowNumber: nextRowNumber,
            data: patch,
            sourceKey: sourceRow.sourceKey,
          }),
        );
        nextRowNumber += 1;
        continue;
      }
      const data = toRowDataRecord(current.data);
      const changed = Object.entries(patch).some(
        ([key, value]) => !sameCellValue(data[key], value),
      );
      if (changed) {
        toUpdate.push({ id: current.id, patch });
      } else {
        unchanged += 1;
      }
    }

    const syncedAt = new Date().toISOString();
    const binding = table.sourceBinding ?? { kind: '', filters: {}, syncedAt: null };
    try {
      await this.customTableRepository.manager.transaction(async manager => {
        const chunkSize = 500;
        for (let i = 0; i < toInsert.length; i += chunkSize) {
          await manager.save(CustomTableRow, toInsert.slice(i, i + chunkSize));
        }
        for (const item of toUpdate) {
          await manager
            .createQueryBuilder()
            .update(CustomTableRow)
            .set({ data: () => 'data || CAST(:patch AS jsonb)' })
            .setParameter('patch', JSON.stringify(item.patch))
            .where('id = :id AND table_id = :tableId', { id: item.id, tableId: table.id })
            .execute();
        }
        await manager.update(
          CustomTable,
          { id: table.id },
          {
            // jsonb: TypeORM's deep-partial type cannot express `unknown` values.
            sourceBinding: {
              ...binding,
              syncedAt,
            } as QueryDeepPartialEntity<CustomTable>['sourceBinding'],
          },
        );
      });
    } catch (error) {
      throwHelpfulSchemaError(error);
    }

    await this.support.logRowBatchCreate({
      userId: params.userId,
      workspaceId: params.workspaceId,
      tableId: table.id,
      rows: toInsert,
      meta: { rowsCreated: toInsert.length, source: 'app_source', kind: binding.kind },
    });

    await this.support.recalcAfterWrite(table.id, params.workspaceId);
    return {
      inserted: toInsert.length,
      updated: toUpdate.length,
      unchanged,
      total: sourceRows.length,
      syncedAt,
    };
  }
}
