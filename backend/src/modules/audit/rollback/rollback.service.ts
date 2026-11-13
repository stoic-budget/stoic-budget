import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { DeepPartial, Repository } from 'typeorm';
import type { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { appError, ERR } from '../../../common/errors/app-error';
import {
  AuditAction,
  AuditEvent,
  type AuditEventDiff,
  EntityType,
} from '../../../entities/audit-event.entity';
import { Category } from '../../../entities/category.entity';
import { CustomTable } from '../../../entities/custom-table.entity';
import { CustomTableColumn } from '../../../entities/custom-table-column.entity';
import { CustomTableRow } from '../../../entities/custom-table-row.entity';
import { Statement } from '../../../entities/statement.entity';
import { Transaction } from '../../../entities/transaction.entity';
import { Workspace } from '../../../entities/workspace.entity';
import { restoreTagSet, touchesTags } from '../../transactions/helpers/tag-set-restore';
import type { RollbackResult } from '../interfaces/audit-event.interface';

type SnapshotRecord = Record<string, unknown>;

const asSnapshotRecord = (value: unknown): SnapshotRecord | null =>
  value && typeof value === 'object' ? (value as SnapshotRecord) : null;

/** Entity types `rollback` below can restore; anything else must not be offered as undoable. */
const ROLLBACK_ENTITY_TYPES: ReadonlySet<EntityType> = new Set([
  EntityType.TRANSACTION,
  EntityType.STATEMENT,
  EntityType.CATEGORY,
  EntityType.TABLE_ROW,
  EntityType.TABLE_CELL,
  EntityType.CUSTOM_TABLE,
  EntityType.CUSTOM_TABLE_COLUMN,
  EntityType.WORKSPACE,
]);

@Injectable()
export class RollbackService {
  private readonly logger = new Logger(RollbackService.name);

  constructor(
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    @InjectRepository(Statement)
    private readonly statementRepository: Repository<Statement>,
    @InjectRepository(Category)
    private readonly categoryRepository: Repository<Category>,
    @InjectRepository(CustomTableRow)
    private readonly customTableRowRepository: Repository<CustomTableRow>,
    @InjectRepository(CustomTable)
    private readonly customTableRepository: Repository<CustomTable>,
    @InjectRepository(CustomTableColumn)
    private readonly customTableColumnRepository: Repository<CustomTableColumn>,
    @InjectRepository(Workspace)
    private readonly workspaceRepository: Repository<Workspace>,
    @InjectRepository(AuditEvent)
    private readonly auditEventRepository: Repository<AuditEvent>,
  ) {}

  static supports(entityType: EntityType): boolean {
    return ROLLBACK_ENTITY_TYPES.has(entityType);
  }

  async rollback(event: AuditEvent): Promise<RollbackResult> {
    switch (event.entityType) {
      case EntityType.TRANSACTION:
        return this.rollbackTransaction(event);
      case EntityType.STATEMENT:
        return this.rollbackStatement(event);
      case EntityType.CATEGORY:
        return this.rollbackCategory(event);
      case EntityType.TABLE_ROW:
        return this.rollbackCustomTableRow(event);
      case EntityType.TABLE_CELL:
        return this.rollbackCustomTableCell(event);
      case EntityType.CUSTOM_TABLE:
        return this.rollbackCustomTable(event);
      case EntityType.CUSTOM_TABLE_COLUMN:
        return this.rollbackCustomTableColumn(event);
      case EntityType.WORKSPACE:
        return this.rollbackWorkspace(event);
      default:
        return {
          success: false,
          message: `Rollback not supported for entity type ${event.entityType}`,
        };
    }
  }

  async rollbackTransaction(event: AuditEvent): Promise<RollbackResult> {
    if (event.action === AuditAction.UPDATE && event.meta?.bulk === 'annotate') {
      return this.rollbackBulkAnnotate(event);
    }
    return this.applyRollback(event, this.transactionRepository);
  }

  /**
   * A bulk tags/comment entry. `tagIds` is a relation, not a column, so the
   * plain update cannot put it back. Like the row's History, it is undone only
   * while the row still holds what the entry wrote: a comment typed since, or
   * tags changed since (by hand or by another bulk add), refuse the undo rather
   * than being overwritten.
   */
  private async rollbackBulkAnnotate(event: AuditEvent): Promise<RollbackResult> {
    const snapshot = this.extractSnapshots(event.diff);
    const before = snapshot?.before ?? {};
    const after = snapshot?.after ?? {};
    const refuse = () => new ConflictException(appError('TRANSACTION_CHANGE_NOT_UNDOABLE'));
    if (Array.isArray(after.tagIds) && (await this.tagsTouchedSince(event))) {
      throw refuse();
    }
    await this.transactionRepository.manager.transaction(async manager => {
      const row = await manager.findOne(Transaction, {
        where: { id: event.entityId, workspaceId: event.workspaceId ?? undefined },
        lock: { mode: 'pessimistic_write' },
      });
      if (!row) {
        throw refuse();
      }
      if ('comments' in after && (row.comments ?? null) !== (after.comments ?? null)) {
        throw refuse();
      }
      if (Array.isArray(after.tagIds)) {
        const restored = await restoreTagSet(
          manager,
          row.id,
          row.workspaceId,
          (before.tagIds as string[]) ?? [],
          after.tagIds as string[],
        );
        if (!restored) {
          throw refuse();
        }
      }
      if ('comments' in before) {
        await manager.update(Transaction, row.id, { comments: before.comments as string | null });
      }
    });
    return { success: true, message: 'Update rolled back' };
  }

  /** Any later entry of the row that changed its tags. */
  private async tagsTouchedSince(event: AuditEvent): Promise<boolean> {
    // Compared in SQL: a JS Date drops the microseconds, so the event would count as its own successor.
    const later = await this.auditEventRepository
      .createQueryBuilder('event')
      .select(['event.id', 'event.meta', 'event.diff'])
      .where('event.entityType = :type AND event.entityId = :id', {
        type: EntityType.TRANSACTION,
        id: event.entityId,
      })
      .andWhere('event.createdAt > (SELECT created_at FROM audit_events WHERE id = :eventId)', {
        eventId: event.id,
      })
      .getMany();
    return later.some(touchesTags);
  }

  async rollbackStatement(event: AuditEvent): Promise<RollbackResult> {
    return this.applyRollback(event, this.statementRepository);
  }

  async rollbackCategory(event: AuditEvent): Promise<RollbackResult> {
    return this.applyRollback(event, this.categoryRepository);
  }

  async rollbackCustomTableRow(event: AuditEvent): Promise<RollbackResult> {
    return this.applyRollback(event, this.customTableRowRepository);
  }

  async rollbackCustomTable(event: AuditEvent): Promise<RollbackResult> {
    return this.applyRollback(event, this.customTableRepository);
  }

  async rollbackCustomTableColumn(event: AuditEvent): Promise<RollbackResult> {
    return this.applyRollback(event, this.customTableColumnRepository);
  }

  async rollbackWorkspace(event: AuditEvent): Promise<RollbackResult> {
    return this.applyRollback(event, this.workspaceRepository);
  }

  async rollbackCustomTableCell(event: AuditEvent): Promise<RollbackResult> {
    if (event.action !== AuditAction.UPDATE) {
      return { success: false, message: `Rollback not supported for action ${event.action}` };
    }

    const columnKey = event.meta?.cell?.column;
    if (!columnKey) {
      return { success: false, message: 'Missing cell column for rollback' };
    }

    const snapshot = this.extractSnapshots(event.diff);
    if (!snapshot?.before) {
      return { success: false, message: 'Missing before state for rollback' };
    }

    try {
      const row = await this.customTableRowRepository.findOne({ where: { id: event.entityId } });
      if (!row) {
        return { success: false, message: 'Row not found for rollback' };
      }
      if (await this.isAppRecordCell(row, columnKey)) {
        // The cell mirrors an app record: rewriting it here would leave the
        // record as it is and the two disagreeing. The record's own event undoes it.
        return { success: false, message: ERR.CELL_LINKED_TO_APP_RECORD };
      }
      const data: CustomTableRow['data'] = { ...(row.data || {}) };
      data[columnKey] = asSnapshotRecord(snapshot.before)?.value ?? null;
      await this.customTableRowRepository.update(event.entityId, {
        // jsonb: TypeORM's deep-partial type cannot express `unknown` values.
        data: data as QueryDeepPartialEntity<CustomTableRow>['data'],
      });
      return { success: true, message: 'Cell update rolled back' };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Rollback failed: ${message}`);
      return { success: false, message };
    }
  }

  /** A source column of a table filled from app data, on a row that came from a record. */
  private async isAppRecordCell(row: CustomTableRow, columnKey: string): Promise<boolean> {
    if (!row.sourceKey) {
      return false;
    }
    const column = await this.customTableColumnRepository.findOne({
      where: { tableId: row.tableId, key: columnKey },
    });
    const source = (column?.config as { source?: { kind?: unknown } } | null | undefined)?.source;
    return source?.kind === 'app_field';
  }

  private async applyRollback<T extends { id: string }>(
    event: AuditEvent,
    repository: Repository<T>,
  ): Promise<RollbackResult> {
    // Safety: rollback only proceeds when a before snapshot exists.
    const snapshot = this.extractSnapshots(event.diff);

    try {
      switch (event.action) {
        case AuditAction.UPDATE: {
          if (!snapshot?.before) {
            return { success: false, message: 'Missing before state for rollback' };
          }
          await repository.update(event.entityId, snapshot.before as QueryDeepPartialEntity<T>);
          return { success: true, message: 'Update rolled back' };
        }
        case AuditAction.DELETE: {
          if (!snapshot?.before) {
            return { success: false, message: 'Missing before state for rollback' };
          }
          let restored = repository.create(snapshot.before as DeepPartial<T>);
          if (event.entityType === EntityType.STATEMENT && 'deletedAt' in restored) {
            const { deletedAt: DeletedAt, ...rest } = restored as unknown as SnapshotRecord;
            restored = rest as unknown as typeof restored;
          }
          await repository.save(restored);
          return { success: true, message: 'Delete rolled back' };
        }
        case AuditAction.CREATE: {
          await repository.delete(event.entityId);
          return { success: true, message: 'Create rolled back' };
        }
        default:
          return { success: false, message: `Rollback not supported for action ${event.action}` };
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Rollback failed: ${message}`);
      return { success: false, message };
    }
  }

  private extractSnapshots(
    diff: AuditEventDiff | null | undefined,
  ): { before: SnapshotRecord | null; after: SnapshotRecord | null } | null {
    if (!diff || Array.isArray(diff)) {
      return null;
    }

    return {
      before: asSnapshotRecord(diff.before),
      after: asSnapshotRecord(diff.after),
    };
  }
}
