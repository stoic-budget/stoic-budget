import type { Repository } from 'typeorm';
import type { Transaction } from '../../../entities/transaction.entity';

/**
 * Locks every part of a split group, in id order: the order a delete locks
 * rows in (lockDeleteClosure), so an unsplit and a delete of one of its parts
 * queue instead of deadlocking. Hands the parts back by splitIndex.
 * No relations: Postgres cannot lock the nullable side of an outer join.
 */
export async function lockSplitGroup(
  repo: Repository<Transaction>,
  workspaceId: string,
  splitGroupId: string,
): Promise<Transaction[]> {
  const parts = await repo.find({
    where: { workspaceId, splitGroupId },
    order: { id: 'ASC' },
    lock: { mode: 'pessimistic_write' },
  });
  return parts.sort((a, b) => (a.splitIndex ?? 0) - (b.splitIndex ?? 0));
}
