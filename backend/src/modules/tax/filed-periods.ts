import { ConflictException } from '@nestjs/common';
import { type EntityManager, LessThanOrEqual, MoreThanOrEqual, Not } from 'typeorm';
import { appError } from '../../common/errors/app-error';
import { TaxReturn, TaxReturnStatus } from '../../entities/tax-return.entity';

/**
 * Refuses to file a period that is filed already, or that overlaps one that
 * is: the shared rows would count in both returns (a year filed beside its
 * quarters), and reopening either would unlock rows the other still claims.
 * Run inside the filing transaction: it takes the workspace's filing lock, so
 * a second filing sent at the same time waits and then sees the first.
 */
export async function assertFilable(
  manager: EntityManager,
  {
    workspaceId,
    periodStart,
    periodEnd,
  }: Pick<TaxReturn, 'workspaceId' | 'periodStart' | 'periodEnd'>,
  existing: TaxReturn | null,
): Promise<void> {
  const returns = manager.getRepository(TaxReturn);
  await lockFilings(manager, workspaceId);
  if (existing?.status === TaxReturnStatus.FILED) {
    throw new ConflictException(appError('TAX_RETURN_ALREADY_FILED'));
  }
  const overlapping = await returns.findOne({
    where: {
      workspaceId,
      status: TaxReturnStatus.FILED,
      periodStart: LessThanOrEqual(periodEnd),
      periodEnd: MoreThanOrEqual(periodStart),
    },
    select: { id: true, periodStart: true, periodEnd: true },
  });
  if (overlapping) {
    throw new ConflictException(
      appError('TAX_RETURN_PERIOD_OVERLAPS', {
        start: String(overlapping.periodStart),
        end: String(overlapping.periodEnd),
      }),
    );
  }
}

/**
 * The rows a return being reopened may unlock: those of its snapshot that no
 * other filed return holds (returns filed before overlaps were refused).
 */
export async function idsToUnlock(manager: EntityManager, reopening: TaxReturn): Promise<string[]> {
  const returns = manager.getRepository(TaxReturn);
  const own = (reopening.snapshot ?? []).map(line => line.transactionId);
  if (own.length === 0) {
    return [];
  }
  await lockFilings(manager, reopening.workspaceId);
  // Only a return whose period overlaps can hold the same rows.
  const others = await returns.find({
    where: {
      workspaceId: reopening.workspaceId,
      status: TaxReturnStatus.FILED,
      id: Not(reopening.id),
      periodStart: LessThanOrEqual(reopening.periodEnd),
      periodEnd: MoreThanOrEqual(reopening.periodStart),
    },
    select: { id: true, snapshot: true },
  });
  const held = new Set(
    others.flatMap(other => (other.snapshot ?? []).map(line => line.transactionId)),
  );
  return own.filter(id => !held.has(id));
}

/** One filing or reopening per workspace at a time, until the transaction ends. */
async function lockFilings(manager: EntityManager, workspaceId: string): Promise<void> {
  await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`tax-returns:${workspaceId}`]);
}
