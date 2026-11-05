import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { type Repository } from 'typeorm';
import { toEnum } from '../../common/effect/to-enum';
import { appError } from '../../common/errors/app-error';
import type {
  CreateCustomTableColumnBody,
  ReorderCustomTableColumnsBody,
  UpdateCustomTableColumnBody,
} from '../../contracts';
import { ActorType, AuditAction, EntityType } from '../../entities/audit-event.entity';
import {
  CustomTableColumn,
  CustomTableColumnType,
} from '../../entities/custom-table-column.entity';
import { AuditService } from '../audit/audit.service';
import { CustomTableFormulaColumnsService } from './custom-table-formula-columns.service';
import { CustomTableRelationsService } from './custom-table-relations.service';
import { CustomTableSupportService } from './custom-table-support.service';
import { validateNumberConfig, validateSelectConfig } from './helpers/column-config';
import { isUuid } from './helpers/row-data';
import { throwHelpfulSchemaError } from './helpers/schema-error';
import { columnSourceConfig, generateColumnKey } from './helpers/source-columns';

@Injectable()
export class CustomTableColumnsService {
  private readonly logger = new Logger(CustomTableColumnsService.name);

  constructor(
    @InjectRepository(CustomTableColumn)
    private readonly customTableColumnRepository: Repository<CustomTableColumn>,
    private readonly auditService: AuditService,
    private readonly support: CustomTableSupportService,
    private readonly formulas: CustomTableFormulaColumnsService,
    private readonly relations: CustomTableRelationsService,
  ) {}

  async addColumn(
    userId: string,
    workspaceId: string,
    tableId: string,
    dto: CreateCustomTableColumnBody,
  ): Promise<CustomTableColumn> {
    await this.support.ensureCanEditCustomTables(userId, workspaceId);
    await this.support.requireTable(workspaceId, tableId);

    const type = toEnum(CustomTableColumnType, dto.type);
    validateNumberConfig(type ?? undefined, dto.config);
    validateSelectConfig(type ?? undefined, dto.config);
    await this.formulas.validateFormulaConfig(
      tableId,
      type ?? undefined,
      dto.config,
      null,
      dto.title,
    );
    await this.relations.validateRelationConfig(workspaceId, type ?? undefined, dto.config);

    const position = dto.position ?? (await this.support.getNextColumnPosition(tableId));
    const column = this.customTableColumnRepository.create({
      tableId,
      key: generateColumnKey(),
      title: dto.title,
      type: type ?? CustomTableColumnType.TEXT,
      isRequired: dto.isRequired ?? false,
      isUnique: dto.isUnique ?? false,
      position,
      config: dto.config ?? null,
    });

    let saved: CustomTableColumn;
    try {
      saved = await this.customTableColumnRepository.save(column);
    } catch (error) {
      throwHelpfulSchemaError(error);
    }
    await this.support.logEvent({
      userId,
      workspaceId,
      entityType: EntityType.CUSTOM_TABLE_COLUMN,
      entityId: saved.id,
      action: AuditAction.CREATE,
      diff: { before: null, after: saved },
      meta: {
        tableId,
        key: saved.key,
      },
    });
    const selfRef = `[${dto.title.trim()}]`;
    if (
      saved.type === CustomTableColumnType.FORMULA &&
      typeof saved.config?.expression === 'string' &&
      saved.config.expression.includes(selfRef)
    ) {
      // Теперь ключ известен: ссылка по названию становится ссылкой по ключу.
      saved.config = {
        ...saved.config,
        expression: saved.config.expression.split(selfRef).join(`[${saved.key}]`),
      };
      try {
        saved = await this.customTableColumnRepository.save(saved);
      } catch (error) {
        throwHelpfulSchemaError(error);
      }
    }
    if (saved.type === CustomTableColumnType.FORMULA) {
      await this.support.recalcAfterWrite(tableId, workspaceId);
    }
    return saved;
  }

  async updateColumn(
    userId: string,
    workspaceId: string,
    tableId: string,
    columnId: string,
    dto: UpdateCustomTableColumnBody,
  ): Promise<CustomTableColumn> {
    await this.support.ensureCanEditCustomTables(userId, workspaceId);
    await this.support.requireTable(workspaceId, tableId);
    if (!isUuid(columnId)) {
      throw new BadRequestException(appError('COLUMN_ID_INVALID'));
    }
    let column: CustomTableColumn | null = null;
    try {
      column = await this.customTableColumnRepository.findOne({
        where: { id: columnId, tableId },
      });
    } catch (error) {
      throwHelpfulSchemaError(error);
    }
    if (!column) {
      throw new NotFoundException(appError('COLUMN_NOT_FOUND'));
    }

    const before = { ...column };
    if (dto.title != null) {
      column.title = dto.title;
    }
    if (dto.type != null) {
      column.type = toEnum(CustomTableColumnType, dto.type);
    }
    if (dto.isRequired != null) {
      column.isRequired = dto.isRequired;
    }
    if (dto.isUnique != null) {
      column.isUnique = dto.isUnique;
    }
    if (dto.position != null) {
      column.position = dto.position;
    }
    if (dto.config !== undefined) {
      const previousSource = columnSourceConfig(column.config);
      column.config = dto.config ?? null;
      // Clients rebuild config from their draft and know nothing about the
      // source link; dropping it would silently stop refreshes for this column.
      if (previousSource && !columnSourceConfig(column.config)) {
        column.config = { ...(column.config ?? {}), source: previousSource };
      }
    }

    validateNumberConfig(column.type, column.config);
    validateSelectConfig(column.type, column.config);
    await this.formulas.validateFormulaConfig(tableId, column.type, column.config, column.key);
    await this.relations.validateRelationConfig(workspaceId, column.type, column.config);

    let saved: CustomTableColumn;
    try {
      saved = await this.customTableColumnRepository.save(column);
    } catch (error) {
      throwHelpfulSchemaError(error);
    }
    await this.support.logEvent({
      userId,
      workspaceId,
      entityType: EntityType.CUSTOM_TABLE_COLUMN,
      entityId: columnId,
      action: AuditAction.UPDATE,
      diff: { before, after: saved },
      meta: { tableId },
    });
    await this.support.recalcAfterWrite(tableId, workspaceId);
    return saved;
  }

  async reorderColumns(
    userId: string,
    workspaceId: string,
    tableId: string,
    dto: ReorderCustomTableColumnsBody,
  ): Promise<void> {
    await this.support.ensureCanEditCustomTables(userId, workspaceId);
    await this.support.requireTable(workspaceId, tableId);
    const invalidId = dto.columnIds.find(id => !isUuid(id));
    if (invalidId) {
      throw new BadRequestException(appError('COLUMN_ID_INVALID'));
    }
    let columns: CustomTableColumn[] = [];
    try {
      columns = await this.customTableColumnRepository.find({
        where: { tableId },
      });
    } catch (error) {
      throwHelpfulSchemaError(error);
    }
    const beforePositions = new Map(columns.map(col => [col.id, col.position ?? 0]));
    const existingIds = new Set(columns.map(c => c.id));
    for (const id of dto.columnIds) {
      if (!existingIds.has(id)) {
        throw new NotFoundException(appError('COLUMN_SOME_NOT_FOUND'));
      }
    }

    const updates = dto.columnIds.map((id, idx) => ({
      id,
      tableId,
      position: idx,
    }));
    try {
      await this.customTableColumnRepository.save(updates);
    } catch (error) {
      throwHelpfulSchemaError(error);
    }
    try {
      await this.auditService.createBatchEvents(
        dto.columnIds.map((id, idx) => ({
          workspaceId,
          actorType: ActorType.USER,
          actorId: userId,
          entityType: EntityType.CUSTOM_TABLE_COLUMN,
          entityId: id,
          action: AuditAction.UPDATE,
          diff: {
            before: { position: beforePositions.get(id) ?? null },
            after: { position: idx },
          },
          meta: { tableId, reorder: true },
        })),
      );
    } catch (error) {
      this.logger.warn(
        `Audit event write failed for column reorder: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async removeColumn(
    userId: string,
    workspaceId: string,
    tableId: string,
    columnId: string,
  ): Promise<void> {
    await this.support.ensureCanEditCustomTables(userId, workspaceId);
    await this.support.requireTable(workspaceId, tableId);
    if (!isUuid(columnId)) {
      throw new BadRequestException(appError('COLUMN_ID_INVALID'));
    }
    let column: CustomTableColumn | null = null;
    try {
      column = await this.customTableColumnRepository.findOne({
        where: { id: columnId, tableId },
      });
    } catch (error) {
      throwHelpfulSchemaError(error);
    }
    if (!column) {
      throw new NotFoundException(appError('COLUMN_NOT_FOUND'));
    }
    try {
      await this.customTableColumnRepository.delete({ id: columnId, tableId });
    } catch (error) {
      throwHelpfulSchemaError(error);
    }
    await this.support.logEvent({
      userId,
      workspaceId,
      entityType: EntityType.CUSTOM_TABLE_COLUMN,
      entityId: columnId,
      action: AuditAction.DELETE,
      diff: { before: column, after: null },
      meta: { tableId, key: column.key },
      isUndoable: true,
    });
    await this.support.recalcAfterWrite(tableId, workspaceId);
  }
}
