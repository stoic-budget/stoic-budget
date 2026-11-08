import type { EntityManager, Repository } from 'typeorm';
import { Transaction, TransferPairSource } from '../../../entities/transaction.entity';
import { TransferPairRejection } from '../../../entities/transfer-pair-rejection.entity';
import { pairKey } from './transfer-pairing.matcher';

/**
 * The pairs the user unlinked in a workspace, as `pairKey`s. All of them: the
 * table only grows by hand, one row per unlink, so it stays small.
 */
export async function rejectedPairKeys(
  rejections: Repository<TransferPairRejection>,
  workspaceId: string,
): Promise<Set<string>> {
  const rows = await rejections.find({
    where: { workspaceId },
    select: { txLowId: true, txHighId: true },
  });
  return new Set(rows.map(row => pairKey(row.txLowId, row.txHighId)));
}

/**
 * Separates the legs of a pair and remembers that these two do not belong
 * together, in one database transaction. The legs themselves go back to
 * "never paired", so each can still pair automatically with another row.
 * A pair of one (a crypto row that is simply not spending) has no partner to
 * refuse, so that row is marked `rejected` and stays out of automatic runs.
 */
export async function unlinkAndRemember(
  manager: EntityManager,
  workspaceId: string,
  transferPairId: string,
): Promise<void> {
  await manager.transaction(async em => {
    const legs = await em.find(Transaction, {
      where: { workspaceId, transferPairId },
      select: { id: true },
    });
    await em.update(
      Transaction,
      { workspaceId, transferPairId },
      {
        transferPairId: null,
        transferPairSource: legs.length === 2 ? null : TransferPairSource.REJECTED,
        transferPairKind: null,
        reimbursementOfId: null,
      },
    );
    if (legs.length !== 2) return;
    const [txLowId, txHighId] = [legs[0].id, legs[1].id].sort();
    await em
      .createQueryBuilder()
      .insert()
      .into(TransferPairRejection)
      .values({ workspaceId, txLowId, txHighId })
      .orIgnore()
      .execute();
  });
}

/** A pair linked by hand is no longer refused. Either order: a restore may have flipped it. */
export async function forgetRejection(
  rejections: Repository<TransferPairRejection>,
  workspaceId: string,
  a: string,
  b: string,
): Promise<void> {
  await rejections.delete([
    { workspaceId, txLowId: a, txHighId: b },
    { workspaceId, txLowId: b, txHighId: a },
  ]);
}
