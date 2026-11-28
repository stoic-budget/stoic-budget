import type { EventEmitter2 } from '@nestjs/event-emitter';
import type { AuditEvent, AuditEventDiff, EntityType } from '../../entities/audit-event.entity';

/** Sent after an audit entry was rolled back, for state derived from what it restored. */
export const AUDIT_ROLLED_BACK = 'audit.rolled-back';

export interface AuditRolledBackEvent {
  workspaceId: string | null;
  entityType: EntityType;
  entityId: string;
  diff: AuditEventDiff | null;
}

/** Tells the listeners, and waits for them: the next read sees what they brought up to date. */
export async function announceRollback(
  emitter: EventEmitter2 | undefined,
  event: Pick<AuditEvent, 'workspaceId' | 'entityType' | 'entityId' | 'diff'>,
): Promise<void> {
  await emitter?.emitAsync(AUDIT_ROLLED_BACK, {
    workspaceId: event.workspaceId,
    entityType: event.entityType,
    entityId: event.entityId,
    diff: event.diff ?? null,
  } satisfies AuditRolledBackEvent);
}

/** The diff of the rollback entry: the original's before and after swapped. */
export function reversedDiff(diff: AuditEventDiff | null | undefined): AuditEventDiff | null {
  if (!diff || Array.isArray(diff)) {
    return diff ?? null;
  }
  return { before: diff.after ?? null, after: diff.before ?? null };
}
