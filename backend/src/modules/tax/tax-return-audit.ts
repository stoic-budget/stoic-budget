import type { Logger } from '@nestjs/common';
import { ActorType, AuditAction, EntityType, Severity } from '../../entities/audit-event.entity';
import type { TaxReturn } from '../../entities/tax-return.entity';
import type { AuditService } from '../audit/audit.service';

/**
 * Records a filing-status change against the persisted return row. Audit
 * failure is logged, never allowed to undo a filing that already committed.
 */
export async function recordStatusChange(
  audit: AuditService,
  logger: Logger,
  change: {
    workspaceId: string;
    userId: string | undefined;
    before: TaxReturn | null;
    after: TaxReturn;
    severity?: Severity;
  },
): Promise<void> {
  const { workspaceId, userId, before, after, severity } = change;
  const snapshot = (row: TaxReturn) => ({
    status: row.status,
    filedAt: row.filedAt ?? null,
    outputTax: row.outputTax,
    inputTax: row.inputTax,
    netPayable: row.netPayable,
    currency: row.currency,
  });

  try {
    await audit.createEvent({
      workspaceId,
      actorType: ActorType.USER,
      actorId: userId ?? null,
      entityType: EntityType.TAX_RETURN,
      entityId: after.id,
      action: AuditAction.UPDATE,
      diff: { before: before ? snapshot(before) : null, after: snapshot(after) },
      meta: { periodStart: after.periodStart, periodEnd: after.periodEnd, status: after.status },
      ...(severity ? { severity } : {}),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    logger.warn(`Audit event failed for tax return ${after.id}: ${message}`);
  }
}
