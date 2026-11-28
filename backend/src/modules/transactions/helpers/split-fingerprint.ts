import { type EntityManager, In, IsNull, Not, type Repository } from 'typeorm';
import { Transaction } from '../../../entities/transaction.entity';

/**
 * A split keeps the bank row's fingerprint on one part (#633), so that
 * importing the row again is known as a repeat. These keep it on a live part
 * when the parts change: no two live rows may share it (unique index), and a
 * part going away must not take the bank row's identity with it.
 */

/**
 * Before split parts are deleted: each hands the copies flagged against it,
 * and its fingerprint, to the first part of its split that stays. The copies
 * are of the whole bank row, which the remaining parts still stand for.
 */
export async function handOverSplitIdentity(
  manager: EntityManager,
  workspaceId: string,
  ids: string[],
): Promise<void> {
  const repo = manager.getRepository(Transaction);
  const leaving = await repo.find({
    where: { workspaceId, id: In(ids), splitGroupId: Not(IsNull()) },
    select: { id: true, splitGroupId: true, fingerprint: true },
  });
  for (const part of leaving) {
    const heir = await repo.findOne({
      where: { workspaceId, splitGroupId: part.splitGroupId as string, id: Not(In(ids)) },
      select: { id: true, fingerprint: true },
      order: { splitIndex: 'ASC' },
    });
    if (!heir) {
      continue;
    }
    await repo.update({ workspaceId, duplicateOfId: part.id }, { duplicateOfId: heir.id });
    if (part.fingerprint && !heir.fingerprint) {
      await repo.update({ workspaceId, id: part.id }, { fingerprint: null });
      await repo.update({ workspaceId, id: heir.id }, { fingerprint: part.fingerprint });
    }
  }
}

/**
 * The part that holds the bank row's fingerprint, if another than `keeper`,
 * gives it to `keeper` (an unsplit's survivor, an undone delete's part).
 */
export async function gatherSplitFingerprint(
  repo: Repository<Transaction>,
  workspaceId: string,
  keeper: Transaction,
  splitGroupId: string,
): Promise<void> {
  const holder = await repo.findOne({
    where: { workspaceId, splitGroupId, fingerprint: Not(IsNull()), id: Not(keeper.id) },
    select: { id: true, fingerprint: true },
  });
  if (!holder) {
    return;
  }
  await repo.update({ workspaceId, id: holder.id }, { fingerprint: null });
  keeper.fingerprint = holder.fingerprint;
}
