import { In, IsNull, Not, type Repository } from 'typeorm';
import { Transaction } from '../../../entities/transaction.entity';

type Copy = { id: string; duplicateOfId: string; fingerprint: string | null };

/**
 * Deletes rows of the workspace, and first gives the copies flagged as their
 * duplicates an original again: left pointing at nothing they stayed
 * duplicates for good, out of every total and with no way to unflag them.
 *
 * In each set of copies one becomes the original and the rest point to it —
 * or, when a live row with the copy's fingerprint already exists, all point to
 * that one (the unique fingerprint index allows one). The new original is the
 * earliest copy in a statement that is not in the trash and not on a filed
 * return, where there is one: a trashed copy counts nowhere, and a locked one
 * would change a filed return. A deleted row gives up its fingerprint first,
 * so its copy can take it over. A transfer pair a deleted row was half of is
 * released.
 *
 * One transaction (a savepoint inside the caller's), and one promotion per
 * workspace at a time: two deletes could otherwise both promote a copy with
 * the same fingerprint.
 */
export async function deletePromotingCopies(
  repo: Repository<Transaction>,
  workspaceId: string,
  ids: readonly string[],
): Promise<void> {
  if (ids.length === 0) return;
  const gone = [...ids];
  await repo.manager.transaction(async manager => {
    const rows = manager.getRepository(Transaction);
    await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`copies:${workspaceId}`]);
    const copies = (await manager.query(
      `SELECT t.id, t.duplicate_of_id AS "duplicateOfId", t.fingerprint
         FROM transactions t LEFT JOIN statements s ON s.id = t.statement_id
        WHERE t.workspace_id = $1 AND t.duplicate_of_id = ANY($2::uuid[])
          AND NOT (t.id = ANY($2::uuid[]))
        ORDER BY (s.deleted_at IS NOT NULL), t.tax_locked, t.transaction_date, t.id
        FOR UPDATE OF t`,
      [workspaceId, gone],
    )) as Copy[];
    const byOriginal = new Map<string, Copy[]>();
    for (const copy of copies) {
      byOriginal.set(copy.duplicateOfId, [...(byOriginal.get(copy.duplicateOfId) ?? []), copy]);
    }
    if (byOriginal.size > 0) {
      await rows.update(
        { workspaceId, id: In([...byOriginal.keys()]), fingerprint: Not(IsNull()) },
        { fingerprint: null },
      );
    }
    for (const group of byOriginal.values()) {
      await promoteOne(rows, workspaceId, gone, group);
    }
    const paired = await rows.find({
      select: { id: true, transferPairId: true },
      where: { workspaceId, id: In(gone), transferPairId: Not(IsNull()) },
    });
    const pairIds = [...new Set(paired.map(row => row.transferPairId as string))];
    if (pairIds.length > 0) {
      await rows.update(
        { workspaceId, transferPairId: In(pairIds), id: Not(In(gone)) },
        { transferPairId: null, transferPairSource: null, transferPairKind: null },
      );
    }
    await rows.delete({ workspaceId, id: In(gone) });
  });
}

async function promoteOne(
  rows: Repository<Transaction>,
  workspaceId: string,
  gone: string[],
  group: Copy[],
): Promise<void> {
  const [first, ...rest] = group;
  const live = first.fingerprint
    ? await rows.findOne({
        select: { id: true },
        where: {
          workspaceId,
          fingerprint: first.fingerprint,
          isDuplicate: false,
          id: Not(In(gone)),
        },
      })
    : null;
  if (!live) {
    await rows.update(
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
    await rows.update(
      { workspaceId, id: In(relinked.map(copy => copy.id)) },
      { duplicateOfId: live?.id ?? first.id },
    );
  }
}
