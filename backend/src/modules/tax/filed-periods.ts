import { ConflictException } from '@nestjs/common';
import { LessThanOrEqual, MoreThanOrEqual, Not, type Repository } from 'typeorm';
import { appError } from '../../common/errors/app-error';
import { TaxReturn, TaxReturnStatus } from '../../entities/tax-return.entity';

/**
 * Refuses to file a period that is filed already, or that overlaps one that
 * is: the shared rows would count in both returns (a year filed beside its
 * quarters), and reopening either would unlock rows the other still claims.
 */
export async function assertFilable(
  returns: Repository<TaxReturn>,
  existing: TaxReturn | null,
  workspaceId: string,
  periodStart: string,
  periodEnd: string,
): Promise<void> {
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
export async function idsToUnlock(
  returns: Repository<TaxReturn>,
  reopening: TaxReturn,
): Promise<string[]> {
  const own = (reopening.snapshot ?? []).map(line => line.transactionId);
  if (own.length === 0) return [];
  const others = await returns.find({
    where: {
      workspaceId: reopening.workspaceId,
      status: TaxReturnStatus.FILED,
      id: Not(reopening.id),
    },
    select: { id: true, snapshot: true },
  });
  const held = new Set(
    others.flatMap(other => (other.snapshot ?? []).map(line => line.transactionId)),
  );
  return own.filter(id => !held.has(id));
}
