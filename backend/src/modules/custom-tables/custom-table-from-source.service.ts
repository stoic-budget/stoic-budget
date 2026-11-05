import { BadRequestException, Injectable, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { type Repository } from 'typeorm';
import { withoutNulls } from '../../common/effect/without-nulls';
import { appError } from '../../common/errors/app-error';
import type {
  CreateCustomTableFromSourceBody,
  PreviewCustomTableSourceBody,
  RestoredTableDefault,
} from '../../contracts';
import { AuditAction, EntityType } from '../../entities/audit-event.entity';
import { CustomTable, CustomTableSource } from '../../entities/custom-table.entity';
import { CustomTableCellStyle } from '../../entities/custom-table-cell-style.entity';
import {
  CustomTableColumn,
  CustomTableColumnType,
} from '../../entities/custom-table-column.entity';
import { CustomTableColumnStyle } from '../../entities/custom-table-column-style.entity';
import { CustomTableRow } from '../../entities/custom-table-row.entity';
import { CustomTableSourceSyncService } from './custom-table-source-sync.service';
import { CustomTableSupportService } from './custom-table-support.service';
import { throwHelpfulSchemaError } from './helpers/schema-error';
import {
  columnSourceConfig,
  generateColumnKey,
  sourceBindingOf,
  sourceColumnConfig,
  sourceFields,
} from './helpers/source-columns';
import { fetchSourceRows, normalizeSourceFilters } from './helpers/source-rows';
import type { SourceFilters, SourceValue } from './sources/source.types';
import { SourceWriteBackService } from './write-back/source-write-back.service';

@Injectable()
export class CustomTableFromSourceService {
  constructor(
    @InjectRepository(CustomTable)
    private readonly customTableRepository: Repository<CustomTable>,
    @InjectRepository(CustomTableColumn)
    private readonly customTableColumnRepository: Repository<CustomTableColumn>,
    private readonly support: CustomTableSupportService,
    private readonly sourceSync: CustomTableSourceSyncService,
    // Optional: cells of tables filled from app data write back through it.
    @Optional() private readonly sourceWriteBack?: SourceWriteBackService,
  ) {}

  async previewSource(
    userId: string,
    workspaceId: string,
    dto: PreviewCustomTableSourceBody,
  ): Promise<{
    count: number;
    columns: Array<{ field: string; title: string; type: CustomTableColumnType }>;
    rows: Array<Record<string, SourceValue>>;
    currencies: string[];
  }> {
    await this.support.ensureCanEditCustomTables(userId, workspaceId);
    const adapter = this.support.requireSources().get(dto.kind);
    const rows = await fetchSourceRows(
      adapter,
      workspaceId,
      normalizeSourceFilters(dto.filters ? withoutNulls(dto.filters) : undefined) as SourceFilters,
    );
    return {
      count: rows.length,
      columns: adapter.columns.map(def => ({
        field: def.field,
        title: dto.columnTitles?.[def.field] || def.title,
        type: def.type,
      })),
      rows: rows.slice(0, 20).map(row => row.values),
      currencies: [
        ...new Set(
          rows
            .map(row => row.values.currency)
            .filter((value): value is string => typeof value === 'string' && value !== ''),
        ),
      ].sort(),
    };
  }

  async createFromSource(
    userId: string,
    workspaceId: string,
    dto: CreateCustomTableFromSourceBody,
  ): Promise<{ tableId: string; columnsCreated: number; rowsCreated: number }> {
    await this.support.ensureCanEditCustomTables(userId, workspaceId);
    const adapter = this.support.requireSources().get(dto.kind);
    const filters = normalizeSourceFilters(dto.filters ? withoutNulls(dto.filters) : undefined);
    const sourceRows = await fetchSourceRows(adapter, workspaceId, filters as SourceFilters);
    if (!sourceRows.length) {
      throw new BadRequestException(appError('SOURCE_EMPTY'));
    }
    const categoryId = dto.categoryId
      ? await this.support.resolveCategoryId(workspaceId, dto.categoryId)
      : null;
    const firstCurrency = sourceRows
      .map(row => row.values.currency)
      .find((value): value is string => typeof value === 'string' && /^[A-Za-z]{3}$/.test(value));
    const currency = (dto.currency ?? firstCurrency)?.toUpperCase();
    const defaultName = `${adapter.kind.charAt(0).toUpperCase()}${adapter.kind.slice(1)}`;
    const name = (dto.name?.trim() || defaultName).slice(0, 120);

    let table: CustomTable;
    try {
      table = await this.customTableRepository.save(
        this.customTableRepository.create({
          userId,
          workspaceId,
          name,
          description: dto.description?.trim() || null,
          source: CustomTableSource.MANUAL,
          categoryId,
          sourceBinding: sourceBindingOf(adapter, filters),
        }),
      );
    } catch (error) {
      throwHelpfulSchemaError(error);
    }

    let columns: CustomTableColumn[];
    try {
      columns = await this.customTableColumnRepository.save(
        adapter.columns.map((def, position) =>
          this.customTableColumnRepository.create({
            tableId: table.id,
            key: generateColumnKey(),
            title: (dto.columnTitles?.[def.field] || def.title).slice(0, 120),
            type: def.type,
            isRequired: false,
            isUnique: false,
            position,
            config: sourceColumnConfig(def, currency),
          }),
        ),
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
      meta: { source: 'app_source', kind: adapter.kind, filters, rowsPlanned: sourceRows.length },
    });

    const result = await this.sourceSync.applySourceRows({
      userId,
      workspaceId,
      table,
      columns,
      sourceRows,
    });
    return { tableId: table.id, columnsCreated: columns.length, rowsCreated: result.inserted };
  }

  /**
   * "Restore to default" of a table filled from app data. First every app
   * record change made from the table is undone (fields changed in the app since
   * are left alone), then the table becomes a fresh copy of its source: columns
   * and rows added by hand, styles, formulas, summaries and view settings go;
   * the source columns get their original type, options and order back (their
   * titles stay); rows of records that no longer exist go too.
   *
   * Idempotent: a second run finds nothing journaled and a table already at default.
   */
  async restoreDefault(
    userId: string,
    workspaceId: string,
    tableId: string,
  ): Promise<RestoredTableDefault> {
    await this.support.ensureCanEditCustomTables(userId, workspaceId);
    const table = await this.support.requireTable(workspaceId, tableId);
    const binding = table.sourceBinding;
    if (!(binding?.kind && this.sourceWriteBack)) {
      throw new BadRequestException(appError('TABLE_NOT_LINKED_TO_SOURCE'));
    }
    const adapter = this.support.requireSources().get(binding.kind);

    const report = await this.sourceWriteBack.revertTable({ userId, workspaceId, table });
    const sourceRows = await fetchSourceRows(
      adapter,
      workspaceId,
      binding.filters as SourceFilters,
    );
    const liveKeys = sourceRows.map(row => row.sourceKey);

    const columns = await this.customTableRepository.manager.transaction(async manager => {
      const columnRepo = manager.getRepository(CustomTableColumn);
      const rowRepo = manager.getRepository(CustomTableRow);
      const existing = await columnRepo.find({ where: { tableId } });
      const byField = new Map<string, CustomTableColumn>();
      const extra: CustomTableColumn[] = [];
      for (const column of existing) {
        const field = columnSourceConfig(column.config);
        const known =
          field?.kind === 'app_field' &&
          field.field &&
          adapter.columns.some(def => def.field === field.field) &&
          !byField.has(field.field);
        if (known && field?.field) {
          byField.set(field.field, column);
        } else {
          extra.push(column);
        }
      }
      const currency = existing
        .map(column => (column.config as { currency?: unknown } | null)?.currency)
        .find((value): value is string => typeof value === 'string' && value.length === 3);

      if (extra.length) {
        await columnRepo.delete(extra.map(column => column.id));
      }
      const kept = adapter.columns.map((def, position) => {
        const column =
          byField.get(def.field) ??
          columnRepo.create({ tableId, key: generateColumnKey(), title: def.title });
        column.type = def.type;
        column.isRequired = false;
        column.isUnique = false;
        column.position = position;
        column.config = sourceColumnConfig(def, currency);
        return column;
      });
      const saved = await columnRepo.save(kept);

      // Rows typed by hand, and rows whose record is gone (all of them when the
      // source has no records left).
      const rowDelete = rowRepo
        .createQueryBuilder()
        .delete()
        .where('table_id = :tableId', { tableId });
      if (liveKeys.length) {
        rowDelete.andWhere('(source_key IS NULL OR source_key NOT IN (:...liveKeys))', {
          liveKeys,
        });
      }
      await rowDelete.execute();
      // What the remaining rows hold beyond the record goes with them: the
      // source values are written back in full below.
      await rowRepo
        .createQueryBuilder()
        .update()
        .set({ data: {}, styles: {}, computed: {} })
        .where('table_id = :tableId', { tableId })
        .execute();
      await manager.getRepository(CustomTableColumnStyle).delete({ tableId });
      await manager
        .createQueryBuilder()
        .delete()
        .from(CustomTableCellStyle)
        .where('row_id IN (SELECT id FROM custom_table_rows WHERE table_id = :tableId)', {
          tableId,
        })
        .execute();
      await manager.getRepository(CustomTable).update({ id: tableId }, { viewSettings: {} });
      return saved;
    });

    table.sourceBinding = { ...binding, fields: sourceFields(adapter) };
    const applied = await this.sourceSync.applySourceRows({
      userId,
      workspaceId,
      table,
      columns,
      sourceRows,
    });
    await this.support.logEvent({
      userId,
      workspaceId,
      entityType: EntityType.CUSTOM_TABLE,
      entityId: tableId,
      action: AuditAction.ROLLBACK,
      meta: {
        restoredDefault: true,
        reverted: report.reverted,
        skippedChanged: report.skippedChanged,
        failed: report.failed.length,
        rows: applied.total,
      },
      isUndoable: false,
    });
    return { tableId, ...report, rows: applied.total };
  }
}
