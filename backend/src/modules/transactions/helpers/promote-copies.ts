import { In, IsNull, Not, type Repository } from 'typeorm';
import { Transaction } from '../../../entities/transaction.entity';

/**
 * Before rows go, the copies flagged as their duplicates get an original
 * again: left pointing at nothing they stayed duplicates for good, out of
 * every total and with no way to unflag them. In each set of copies the
 * earliest becomes the original — or, when a live original with the same
 * fingerprint already exists, the copies point to it instead (the unique
 * fingerprint index allows one) — and the rest point to it. A transfer pair a
 * deleted row was half of is released.
 */
export async function promoteCopiesOf(
  repo: Repository<Transaction>,
  workspaceId: string,
  ids: readonly string[],
): Promise<void> {
  if (ids.length === 0) return;
  const copies = await repo.find({
    select: { id: true, duplicateOfId: true, fingerprint: true },
    where: { workspaceId, duplicateOfId: In([...ids]), id: Not(In([...ids])) },
    order: { transactionDate: 'ASC', id: 'ASC' },
  });
  const byOriginal = new Map<string, Transaction[]>();
  for (const copy of copies) {
    const key = copy.duplicateOfId as string;
    byOriginal.set(key, [...(byOriginal.get(key) ?? []), copy]);
  }
  for (const group of byOriginal.values()) {
    const [first, ...rest] = group;
    const live = first.fingerprint
      ? await repo.findOne({
          select: { id: true },
          where: {
            workspaceId,
            fingerprint: first.fingerprint,
            isDuplicate: false,
            id: Not(In([...ids])),
          },
        })
      : null;
    const original = live?.id ?? first.id;
    if (!live) {
      await repo.update(
        { workspaceId, id: first.id },
        {
          isDuplicate: false,
          duplicateOfId: null,
          duplicateConfidence: null,
          duplicateMatchType: null,
        },
      );
    }
    const relinked = live ? group : rest;
    if (relinked.length > 0) {
      await repo.update(
        { workspaceId, id: In(relinked.map(copy => copy.id)) },
        { duplicateOfId: original },
      );
    }
  }
  const paired = await repo.find({
    select: { id: true, transferPairId: true },
    where: { workspaceId, id: In([...ids]), transferPairId: Not(IsNull()) },
  });
  const pairIds = [...new Set(paired.map(row => row.transferPairId as string))];
  if (pairIds.length > 0) {
    await repo.update(
      { workspaceId, transferPairId: In(pairIds), id: Not(In([...ids])) },
      { transferPairId: null, transferPairSource: null, transferPairKind: null },
    );
  }
}
