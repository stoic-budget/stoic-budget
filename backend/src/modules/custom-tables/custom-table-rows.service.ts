import { randomUUID } from 'node:crypto';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { type Repository } from 'typeorm';
import { appError } from '../../common/errors/app-error';
import type {
  BatchCreateCustomTableRowsBody,
  CreateCustomTableRowBody,
  UpdateCustomTableRowBody,
} from '../../contracts';
import { AuditAction, EntityType } from '../../entities/audit-event.entity';
import { CustomTableColumn } from '../../entities/custom-table-column.entity';
import { CustomTableRow } from '../../entities/custom-table-row.entity';
import { CustomTableRowValidationService } from './custom-table-row-validation.service';
import { CustomTableSupportService } from './custom-table-support.service';
import {
  applyFormulaColumns,
  isUuid,
  sameCellValue,
  sanitizeRowData,
  toRowDataRecord,
} from './helpers/row-data';
import { throwHelpfulSchemaError } from './helpers/schema-error';
import type { SourceValue } from './sources/source.types';

@Injectable()
export class CustomTableRowsService {
  constructor(
    @InjectRepository(CustomTableColumn)
    private readonly customTableColumnRepository: Repository<CustomTableColumn>,
    @InjectRepository(CustomTableRow)
    private readonly customTableRowRepository: Repository<CustomTableRow>,
    private readonly support: CustomTableSupportService,
    private readonly rowValidation: CustomTableRowValidationService,
  ) {}

  async createRow(
    userId: string,
    workspaceId: string,
    tableId: string,
    dto: CreateCustomTableRowBody,
  ): Promise<CustomTableRow> {
    await this.support.ensureCanEditCustomTables(userId, workspaceId);
    await this.support.requireTable(workspaceId, tableId);
    const allowedKeys = await this.support.getAllowedColumnKeys(tableId);
    const data = sanitizeRowData(dto.data, allowedKeys);
    await this.rowValidation.validateRowsAgainstColumns(tableId, [data]);
    const rowNumber = dto.rowNumber ?? (await this.support.getNextRowNumber(tableId));

    const row = this.customTableRowRepository.create({
      tableId,
      rowNumber,
      data,
      styles: dto.styles ?? {},
    });
    let saved: CustomTableRow;
    try {
      saved = await this.customTableRowRepository.save(row);
    } catch (error) {
      throwHelpfulSchemaError(error);
    }
    await this.support.logEvent({
      userId,
      workspaceId,
      entityType: EntityType.TABLE_ROW,
      entityId: saved.id,
      action: AuditAction.CREATE,
      diff: { before: null, after: saved },
      meta: { tableId, rowNumber: saved.rowNumber },
    });
    // В ответе — уже посчитанные формулы: грид обновляет строку из ответа,
    // не перечитывая таблицу, и без этого формульные ячейки отставали бы.
    await this.support.recalcAfterWrite(tableId, workspaceId, [saved]);
    applyFormulaColumns(
      [saved],
      await this.customTableColumnRepository.find({ where: { tableId } }),
    );
    return saved;
  }

  async updateRow(
    userId: string,
    workspaceId: string,
    tableId: string,
    rowId: string,
    dto: UpdateCustomTableRowBody,
  ): Promise<CustomTableRow> {
    await this.support.ensureCanEditCustomTables(userId, workspaceId);
    const table = await this.support.requireTable(workspaceId, tableId);
    if (!isUuid(rowId)) {
      throw new BadRequestException(appError('ROW_ID_INVALID'));
    }
    let row: CustomTableRow | null = null;
    try {
      row = await this.customTableRowRepository.findOne({
        where: { id: rowId, tableId },
      });
    } catch (error) {
      throwHelpfulSchemaError(error);
    }
    if (!row) {
      throw new NotFoundException(appError('ROW_NOT_FOUND'));
    }

    const allowedKeys = await this.support.getAllowedColumnKeys(tableId);
    let patch = sanitizeRowData(dto.data, allowedKeys);
    const writeBack = await this.rowValidation.writeBackAppFields(
      userId,
      workspaceId,
      table,
      row,
      patch,
    );
    if (writeBack) {
      // The row shows the app record: its app cells take what the app now holds,
      // also when the app refused — then nothing else of this edit is saved.
      patch = writeBack.error ? writeBack.values : { ...patch, ...writeBack.values };
    }
    if (!writeBack?.error) {
      await this.rowValidation.validateRowsAgainstColumns(tableId, [patch], {
        excludeRowId: rowId,
        partial: true,
      });
    }
    const beforeData = { ...(row.data || {}) };
    const beforeStyles = row.styles ? { ...row.styles } : null;
    row.data = { ...(row.data || {}), ...patch };
    if (dto.styles && typeof dto.styles === 'object' && !writeBack?.error) {
      row.styles = { ...(row.styles || {}), ...dto.styles };
    }

    if (writeBack?.error) {
      try {
        await this.customTableRowRepository.save(row);
      } catch (error) {
        throwHelpfulSchemaError(error);
      }
      throw writeBack.error;
    }

    let saved: CustomTableRow;
    try {
      saved = await this.customTableRowRepository.save(row);
    } catch (error) {
      throwHelpfulSchemaError(error);
    }
    const patchKeys = Object.keys(patch || {}).filter(
      key => !sameCellValue(beforeData?.[key] ?? null, (patch[key] ?? null) as SourceValue),
    );
    const batchId = patchKeys.length > 1 ? randomUUID() : null;

    for (const key of patchKeys) {
      const beforeValue = beforeData?.[key] ?? null;
      const afterValue = toRowDataRecord(saved.data)[key] ?? null;
      await this.support.logEvent({
        userId,
        workspaceId,
        entityType: EntityType.TABLE_CELL,
        entityId: rowId,
        action: AuditAction.UPDATE,
        diff: {
          before: { value: beforeValue },
          after: { value: afterValue },
        },
        meta: {
          tableId,
          cell: { column: key },
        },
        batchId,
        // Undo of an app cell would rewrite the table and leave the record as it
        // is; the record's own event is the one to undo.
        ...(writeBack && key in writeBack.values ? { isUndoable: false } : {}),
      });
    }

    if (dto.styles && typeof dto.styles === 'object') {
      await this.support.logEvent({
        userId,
        workspaceId,
        entityType: EntityType.TABLE_ROW,
        entityId: rowId,
        action: AuditAction.UPDATE,
        diff: {
          before: { styles: beforeStyles },
          after: { styles: saved.styles },
        },
        meta: {
          tableId,
          stylesUpdated: true,
        },
      });
    }
    // В ответе — уже посчитанные формулы: грид обновляет строку из ответа,
    // не перечитывая таблицу, и без этого формульные ячейки отставали бы.
    await this.support.recalcAfterWrite(tableId, workspaceId, [saved]);
    applyFormulaColumns(
      [saved],
      await this.customTableColumnRepository.find({ where: { tableId } }),
    );
    return saved;
  }

  async removeRow(
    userId: string,
    workspaceId: string,
    tableId: string,
    rowId: string,
  ): Promise<void> {
    await this.support.ensureCanEditCustomTables(userId, workspaceId);
    await this.support.requireTable(workspaceId, tableId);
    if (!isUuid(rowId)) {
      throw new BadRequestException(appError('ROW_ID_INVALID'));
    }
    let row: CustomTableRow | null = null;
    try {
      row = await this.customTableRowRepository.findOne({
        where: { id: rowId, tableId },
      });
    } catch (error) {
      throwHelpfulSchemaError(error);
    }
    if (!row) {
      throw new NotFoundException(appError('ROW_NOT_FOUND'));
    }
    try {
      await this.customTableRowRepository.delete({ id: rowId, tableId });
    } catch (error) {
      throwHelpfulSchemaError(error);
    }
    await this.support.logEvent({
      userId,
      workspaceId,
      entityType: EntityType.TABLE_ROW,
      entityId: rowId,
      action: AuditAction.DELETE,
      diff: { before: row, after: null },
      meta: { tableId, rowNumber: row.rowNumber },
      isUndoable: true,
    });
    await this.support.recalcAfterWrite(tableId, workspaceId);
  }

  async batchCreateRows(
    userId: string,
    workspaceId: string,
    tableId: string,
    dto: BatchCreateCustomTableRowsBody,
  ): Promise<{ created: number; rows: CustomTableRow[] }> {
    await this.support.ensureCanEditCustomTables(userId, workspaceId);
    await this.support.requireTable(workspaceId, tableId);
    const allowedKeys = await this.support.getAllowedColumnKeys(tableId);

    let nextRowNumber = await this.support.getNextRowNumber(tableId);
    const rows = dto.rows.map(row => {
      const rowNumber = row.rowNumber ?? nextRowNumber++;
      return this.customTableRowRepository.create({
        tableId,
        rowNumber,
        data: sanitizeRowData(row.data, allowedKeys),
        styles: row.styles ?? {},
      });
    });

    // Весь пакет проверяем разом: дубли внутри одной загрузки база не поймает,
    // потому что до вставки их там ещё нет.
    await this.rowValidation.validateRowsAgainstColumns(
      tableId,
      rows.map(row => toRowDataRecord(row.data)),
    );

    let savedRows: CustomTableRow[];
    try {
      savedRows = await this.customTableRowRepository.save(rows);
    } catch (error) {
      throwHelpfulSchemaError(error);
    }
    await this.support.logRowBatchCreate({
      userId,
      workspaceId,
      tableId,
      rows: savedRows,
      meta: {
        count: rows.length,
      },
    });
    await this.support.recalcAfterWrite(tableId, workspaceId, savedRows);
    applyFormulaColumns(
      savedRows,
      await this.customTableColumnRepository.find({ where: { tableId } }),
    );
    return { created: savedRows.length, rows: savedRows };
  }
}
