import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, type Repository } from 'typeorm';
import { appError } from '../../common/errors/app-error';
import { ensureCanEdit } from '../../common/utils/ensure-can-edit.util';
import {
  ActorType,
  AuditAction,
  type AuditEventDiff,
  EntityType,
  Severity,
} from '../../entities/audit-event.entity';
import { Category } from '../../entities/category.entity';
import { CustomTable } from '../../entities/custom-table.entity';
import {
  CustomTableColumn,
  CustomTableColumnType,
} from '../../entities/custom-table-column.entity';
import { CustomTableColumnStyle } from '../../entities/custom-table-column-style.entity';
import { CustomTableRow } from '../../entities/custom-table-row.entity';
import { WorkspaceMember } from '../../entities/workspace-member.entity';
import { AuditService } from '../audit/audit.service';
import { CustomTableSourcesService } from './custom-table-sources.service';
import { FormulaRecalcService } from './formula-recalc.service';
import { storageTypeOf } from './helpers/column-config';
import { attachColumnStyles, isUuid, type JsonObject } from './helpers/row-data';
import { throwHelpfulSchemaError } from './helpers/schema-error';

/** What every custom-table service shares: access checks, table lookup, audit events and recalc. */
@Injectable()
export class CustomTableSupportService {
  private readonly logger = new Logger(CustomTableSupportService.name);

  constructor(
    @InjectRepository(CustomTable)
    private readonly customTableRepository: Repository<CustomTable>,
    @InjectRepository(Category)
    private readonly categoryRepository: Repository<Category>,
    @InjectRepository(CustomTableColumn)
    private readonly customTableColumnRepository: Repository<CustomTableColumn>,
    @InjectRepository(CustomTableRow)
    private readonly customTableRowRepository: Repository<CustomTableRow>,
    @InjectRepository(CustomTableColumnStyle)
    private readonly customTableColumnStyleRepository: Repository<CustomTableColumnStyle>,
    @InjectRepository(WorkspaceMember)
    private readonly workspaceMemberRepository: Repository<WorkspaceMember>,
    private readonly auditService: AuditService,
    // Optional for the same reason: most unit specs never touch app data sources.
    @Optional() private readonly customTableSources?: CustomTableSourcesService,
    // Optional too: unit specs build the service by hand and never recalc.
    @Optional() private readonly formulaRecalc?: FormulaRecalcService,
  ) {}

  async ensureCanEditCustomTables(userId: string, workspaceId: string): Promise<void> {
    await ensureCanEdit(
      this.workspaceMemberRepository,
      workspaceId,
      userId,
      'canEditCustomTables',
      'TABLES_EDIT_FORBIDDEN',
    );
  }

  async ensureCanEditStatements(userId: string, workspaceId: string): Promise<void> {
    await ensureCanEdit(
      this.workspaceMemberRepository,
      workspaceId,
      userId,
      'canEditStatements',
      'STATEMENTS_EDIT_FORBIDDEN',
    );
  }

  async requireTable(workspaceId: string, tableId: string): Promise<CustomTable> {
    if (!isUuid(tableId)) {
      throw new BadRequestException(appError('TABLE_ID_INVALID'));
    }
    try {
      const qb = this.customTableRepository
        .createQueryBuilder('table')
        .leftJoinAndSelect('table.user', 'owner')
        .where('table.id = :tableId', { tableId })
        .andWhere('table.workspaceId = :workspaceId', { workspaceId });

      const table = await qb.getOne();
      if (!table) {
        throw new NotFoundException(appError('TABLE_NOT_FOUND'));
      }
      return table;
    } catch (error) {
      throwHelpfulSchemaError(error);
    }
    throw new NotFoundException(appError('TABLE_NOT_FOUND'));
  }

  async resolveCategoryId(workspaceId: string, categoryId: string): Promise<string> {
    let category: Category | null = null;
    try {
      const qb = this.categoryRepository
        .createQueryBuilder('category')
        .where('category.id = :categoryId', { categoryId })
        .andWhere('category.workspaceId = :workspaceId', { workspaceId });

      category = await qb.getOne();
    } catch (error) {
      throwHelpfulSchemaError(error);
    }
    if (!category) {
      throw new BadRequestException(appError('CATEGORY_NOT_FOUND'));
    }
    return category.id;
  }

  async getAllowedColumnKeys(tableId: string): Promise<Set<string>> {
    const columns = await this.customTableColumnRepository.find({
      where: { tableId },
      select: {
        key: true,
      },
    });
    return new Set(columns.map(c => c.key));
  }

  async getNextColumnPosition(tableId: string): Promise<number> {
    const raw = await this.customTableColumnRepository
      .createQueryBuilder('c')
      .select('MAX(c.position)', 'max')
      .where('c.tableId = :tableId', { tableId })
      .getRawOne<{ max: string | null }>();

    const max = raw?.max ? Number(raw.max) : 0;
    return Number.isFinite(max) ? max + 1 : 1;
  }

  async getNextRowNumber(tableId: string): Promise<number> {
    const raw = await this.customTableRowRepository
      .createQueryBuilder('r')
      .select('MAX(r.rowNumber)', 'max')
      .where('r.tableId = :tableId', { tableId })
      .getRawOne<{ max: string | null }>();

    const max = raw?.max ? Number(raw.max) : 0;
    return Number.isFinite(max) ? max + 1 : 1;
  }

  async logEvent(params: {
    userId: string;
    workspaceId: string | null;
    entityType: EntityType;
    entityId: string;
    action: AuditAction;
    diff?: AuditEventDiff | null;
    meta?: JsonObject | null;
    batchId?: string | null;
    severity?: Severity;
    isUndoable?: boolean;
  }) {
    try {
      // Audit: capture custom table mutations (tables, columns, rows, cells).
      await this.auditService.createEvent({
        workspaceId: params.workspaceId,
        actorType: ActorType.USER,
        actorId: params.userId,
        entityType: params.entityType,
        entityId: params.entityId,
        action: params.action,
        diff: params.diff ?? null,
        meta: params.meta ?? null,
        batchId: params.batchId ?? null,
        severity: params.severity ?? Severity.INFO,
        isUndoable: params.isUndoable,
      });
    } catch (error) {
      this.logger.warn(
        `Audit event write failed for action=${params.action}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async logRowBatchCreate(params: {
    userId: string;
    workspaceId: string | null;
    tableId: string;
    rows: CustomTableRow[];
    meta?: JsonObject;
  }) {
    if (!params.rows.length) {
      return;
    }
    try {
      await this.auditService.createBatchEvents(
        params.rows.map(row => ({
          workspaceId: params.workspaceId,
          actorType: ActorType.USER,
          actorId: params.userId,
          entityType: EntityType.TABLE_ROW,
          entityId: row.id,
          action: AuditAction.CREATE,
          diff: { before: null, after: row },
          meta: { tableId: params.tableId, rowNumber: row.rowNumber, ...(params.meta || {}) },
        })),
      );
    } catch (error) {
      this.logger.warn(
        `Audit event batch write failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /** После записи: пересчитать формулы и отдать строкам свежие значения из computed. */
  async recalcAfterWrite(
    tableId: string,
    workspaceId: string,
    rows: CustomTableRow[] = [],
  ): Promise<void> {
    if (!this.formulaRecalc) {
      return;
    }
    const mode = await this.formulaRecalc.scheduleRecalc(tableId, workspaceId);
    if (mode !== 'sync' || !rows.length) {
      return;
    }
    const fresh = await this.customTableRowRepository.find({
      where: { id: In(rows.map(row => row.id)) },
      select: {
        id: true,
        computed: true,
      },
    });
    const byId = new Map(fresh.map(row => [row.id, row.computed]));
    for (const row of rows) {
      row.computed = byId.get(row.id) ?? row.computed;
    }
  }

  async loadColumnsWithConfig(tableId: string): Promise<CustomTableColumn[]> {
    return this.customTableColumnRepository.find({
      where: { tableId },
      order: { position: 'ASC' },
    });
  }

  async loadColumnTypeMap(tableId: string): Promise<Map<string, CustomTableColumnType>> {
    const columns = await this.customTableColumnRepository.find({
      where: { tableId },
      select: {
        key: true,
        type: true,
        config: true,
      },
    });
    return new Map<string, CustomTableColumnType>(columns.map(c => [c.key, storageTypeOf(c)]));
  }

  async getTable(workspaceId: string, tableId: string): Promise<CustomTable> {
    await this.requireTable(workspaceId, tableId);
    let table: CustomTable | null = null;
    try {
      table = await this.customTableRepository.findOne({
        where: { id: tableId },
        relations: { columns: true, category: true },
      });
    } catch (error) {
      throwHelpfulSchemaError(error);
    }
    if (!table) {
      throw new NotFoundException(appError('TABLE_NOT_FOUND'));
    }

    table.columns = (table.columns || []).sort((a, b) => a.position - b.position);

    try {
      const styles = await this.customTableColumnStyleRepository.find({
        where: { tableId },
        select: {
          columnKey: true,
          style: true,
        },
      });
      const byKey = new Map(styles.map(s => [s.columnKey, s.style]));
      table.columns = attachColumnStyles(table.columns, byKey);
    } catch (_error) {
      this.logger.warn(`Failed to load column styles for tableId=${tableId}`);
    }

    return table;
  }

  // ── Fill from app data ───────────────────────────────────────────────────

  requireSources(): CustomTableSourcesService {
    if (!this.customTableSources) {
      throw new BadRequestException(appError('SOURCE_KIND_UNKNOWN'));
    }
    return this.customTableSources;
  }
}
