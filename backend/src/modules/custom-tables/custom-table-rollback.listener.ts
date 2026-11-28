import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { EntityType } from '../../entities/audit-event.entity';
import { CustomTable } from '../../entities/custom-table.entity';
import { CustomTableColumn } from '../../entities/custom-table-column.entity';
import { CustomTableRow } from '../../entities/custom-table-row.entity';
import { AUDIT_ROLLED_BACK, type AuditRolledBackEvent } from '../audit/audit-rolled-back.event';
import { CustomTablesCacheService } from './custom-tables-cache.service';
import { FormulaRecalcService } from './formula-recalc.service';

const TABLE_ENTITIES = new Set<EntityType>([
  EntityType.TABLE_ROW,
  EntityType.TABLE_CELL,
  EntityType.CUSTOM_TABLE_COLUMN,
  EntityType.CUSTOM_TABLE,
]);

/**
 * A rolled-back cell, row or column writes the table past its service: the
 * formulas next to it and the cached rows are brought up to date here, as
 * after any other write.
 */
@Injectable()
export class CustomTableRollbackListener {
  private readonly logger = new Logger(CustomTableRollbackListener.name);

  constructor(
    @InjectRepository(CustomTableRow)
    private readonly rows: Repository<CustomTableRow>,
    @InjectRepository(CustomTableColumn)
    private readonly columns: Repository<CustomTableColumn>,
    @InjectRepository(CustomTable)
    private readonly tables: Repository<CustomTable>,
    private readonly recalc: FormulaRecalcService,
    private readonly cache: CustomTablesCacheService,
  ) {}

  @OnEvent(AUDIT_ROLLED_BACK, { promisify: true })
  async onRolledBack(event: AuditRolledBackEvent): Promise<void> {
    if (!(event.workspaceId && TABLE_ENTITIES.has(event.entityType))) return;
    const workspaceId = event.workspaceId;
    try {
      // A table renamed, created or deleted back changes the list of tables.
      if (event.entityType === EntityType.CUSTOM_TABLE) await this.cache.bumpList(workspaceId);
      const tableId = await this.tableOf(event, workspaceId);
      if (!tableId) return;
      await this.recalc.scheduleRecalc(tableId, workspaceId);
      await this.cache.bumpRows(workspaceId, tableId);
      await this.cache.bumpTable(workspaceId, tableId);
    } catch (error) {
      this.logger.error(
        `Recalc after rollback failed for ${event.entityType} ${event.entityId}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  /** The table the entry touched, this workspace's: from the row or column, or the entry's snapshot. */
  private async tableOf(event: AuditRolledBackEvent, workspaceId: string): Promise<string | null> {
    const snapshot = event.diff && !Array.isArray(event.diff) ? event.diff : null;
    const recorded = [snapshot?.before, snapshot?.after]
      .map(side => (side as { tableId?: unknown } | null | undefined)?.tableId)
      .find((value): value is string => typeof value === 'string');
    const repository =
      event.entityType === EntityType.CUSTOM_TABLE_COLUMN ? this.columns : this.rows;
    const candidate =
      event.entityType === EntityType.CUSTOM_TABLE
        ? event.entityId
        : ((
            await repository.findOne({
              where: { id: event.entityId },
              select: { id: true, tableId: true },
            })
          )?.tableId ?? recorded);
    if (!candidate) return null;
    const owned = await this.tables.exists({ where: { id: candidate, workspaceId } });
    return owned ? candidate : null;
  }
}
