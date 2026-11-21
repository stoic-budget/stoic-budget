import { type EntityManager, In, IsNull, Not } from 'typeorm';
import {
  Transaction,
  TransferPairKind,
  type TransferPairSource,
} from '../../../entities/transaction.entity';

/**
 * What a deleted row was linked to, kept in its audit entry so that undoing the
 * delete puts back exactly what the delete took apart.
 */
export interface DeletedRowLinks {
  /** The other rows of its transfer or reimbursement pair, as they were paired. */
  partners: Array<{
    id: string;
    transferPairId: string;
    transferPairSource: TransferPairSource | null;
    transferPairKind: TransferPairKind | null;
  }>;
  /** Rows flagged as duplicates of it. */
  copies: Array<{
    id: string;
    duplicateConfidence: string | null;
    duplicateMatchType: string | null;
  }>;
  /** The other parts of its split. */
  splitSiblings: Array<{ id: string; splitGroupId: string; splitIndex: number | null }>;
  /** Incoming rows that pay it back (a partial reimbursement links without a pair). */
  reimbursements: string[];
}

type Linked = Pick<
  Transaction,
  | 'id'
  | 'statementId'
  | 'transferPairId'
  | 'transferPairSource'
  | 'transferPairKind'
  | 'duplicateOfId'
  | 'duplicateConfidence'
  | 'duplicateMatchType'
  | 'splitGroupId'
  | 'splitIndex'
  | 'reimbursementOfId'
>;

/**
 * Locks the rows to delete together with every row the delete will change
 * (transfer and reimbursement partners, split siblings, duplicate copies) in
 * one statement, in id order. Two deletes touching the same rows then queue
 * instead of each holding one half of a pair and waiting for the other.
 */
export async function lockDeleteClosure(
  manager: EntityManager,
  workspaceId: string,
  ids: string[],
): Promise<Linked[]> {
  const locked: Array<{ id: string }> = await manager.query(
    `SELECT t.id FROM transactions t
     WHERE t.workspace_id = $1 AND (
       t.id = ANY($2::uuid[])
       OR t.duplicate_of_id = ANY($2::uuid[])
       OR t.reimbursement_of_id = ANY($2::uuid[])
       OR t.transfer_pair_id IN (
         SELECT s.transfer_pair_id FROM transactions s
         WHERE s.workspace_id = $1 AND s.id = ANY($2::uuid[]) AND s.transfer_pair_id IS NOT NULL)
       OR t.split_group_id IN (
         SELECT s.split_group_id FROM transactions s
         WHERE s.workspace_id = $1 AND s.id = ANY($2::uuid[]) AND s.split_group_id IS NOT NULL)
     )
     ORDER BY t.id FOR UPDATE OF t`,
    [workspaceId, ids],
  );
  // Read again after the locks: a row may have changed while this one waited.
  return manager.getRepository(Transaction).find({
    select: {
      id: true,
      statementId: true,
      transferPairId: true,
      transferPairSource: true,
      transferPairKind: true,
      duplicateOfId: true,
      duplicateConfidence: true,
      duplicateMatchType: true,
      splitGroupId: true,
      splitIndex: true,
      reimbursementOfId: true,
    },
    where: { workspaceId, id: In(locked.map(row => row.id)) },
  });
}

/** For each row to delete, what links to it among the locked rows. */
export function linksOf(row: Linked, closure: Linked[]): DeletedRowLinks {
  const others = closure.filter(other => other.id !== row.id);
  return {
    partners: others.flatMap(other =>
      row.transferPairId && other.transferPairId === row.transferPairId
        ? [
            {
              id: other.id,
              transferPairId: row.transferPairId,
              transferPairSource: other.transferPairSource,
              transferPairKind: other.transferPairKind,
            },
          ]
        : [],
    ),
    copies: others
      .filter(other => other.duplicateOfId === row.id)
      .map(other => ({
        id: other.id,
        duplicateConfidence:
          other.duplicateConfidence === null ? null : String(other.duplicateConfidence),
        duplicateMatchType: other.duplicateMatchType,
      })),
    splitSiblings: others.flatMap(other =>
      row.splitGroupId && other.splitGroupId === row.splitGroupId
        ? [{ id: other.id, splitGroupId: row.splitGroupId, splitIndex: other.splitIndex }]
        : [],
    ),
    reimbursements: others.filter(other => other.reimbursementOfId === row.id).map(o => o.id),
  };
}

/**
 * Deletes the rows and keeps what hung on them true: copies of a deleted row
 * are unflagged (the charge would vanish with its master), the other leg of a
 * pair is released (it would stay out of every figure with no partner), and the
 * last part left of a split is a plain row again, as unsplit leaves it.
 */
export async function deleteAndDetach(
  manager: EntityManager,
  workspaceId: string,
  rows: Linked[],
): Promise<void> {
  const repo = manager.getRepository(Transaction);
  const ids = rows.map(row => row.id);
  await repo.update(
    { workspaceId, duplicateOfId: In(ids), id: Not(In(ids)) },
    {
      isDuplicate: false,
      duplicateOfId: null,
      duplicateConfidence: null,
      duplicateMatchType: null,
    },
  );
  await repo.delete({ workspaceId, id: In(ids) });

  const pairIds = distinct(rows.map(row => row.transferPairId));
  if (pairIds.length > 0) {
    await repo.update(
      { workspaceId, transferPairId: In(pairIds) },
      { transferPairId: null, transferPairSource: null, transferPairKind: null },
    );
  }
  const groupIds = distinct(rows.map(row => row.splitGroupId));
  if (groupIds.length > 0) {
    await clearLoneSplitParts(manager, workspaceId, groupIds);
  }
}

/**
 * Undo of a delete, after the row itself is back: re-pairs a partner the delete
 * released and re-flags its copies (each only while still unpaired, unflagged
 * and not split since), rejoins split
 * siblings and reimbursements. A link that cannot be restored is dropped from
 * the restored row, so it never comes back hidden with nobody to explain it.
 */
export async function restoreLinks(
  manager: EntityManager,
  workspaceId: string,
  restored: Pick<Transaction, 'id' | 'transferPairId' | 'transferPairKind' | 'splitGroupId'>,
  links: DeletedRowLinks,
): Promise<void> {
  const repo = manager.getRepository(Transaction);
  for (const partner of links.partners) {
    await repo.update(
      // A partner split meanwhile is a different charge now: left alone.
      { workspaceId, id: partner.id, transferPairId: IsNull(), splitGroupId: IsNull() },
      {
        transferPairId: partner.transferPairId,
        transferPairSource: partner.transferPairSource,
        transferPairKind: partner.transferPairKind,
      },
    );
  }
  // A pair of one is no pair, except an investment, which pairs with itself.
  if (restored.transferPairId && restored.transferPairKind !== TransferPairKind.INVESTMENT) {
    const legs = await repo.count({
      where: { workspaceId, transferPairId: restored.transferPairId },
    });
    if (legs < 2) {
      await repo.update(
        { workspaceId, id: restored.id },
        { transferPairId: null, transferPairSource: null, transferPairKind: null },
      );
    }
  }
  for (const copy of links.copies) {
    await repo.update(
      // A copy split meanwhile is not re-flagged: its parts carry the charge now.
      {
        workspaceId,
        id: copy.id,
        isDuplicate: false,
        duplicateOfId: IsNull(),
        splitGroupId: IsNull(),
      },
      {
        isDuplicate: true,
        duplicateOfId: restored.id,
        duplicateConfidence:
          copy.duplicateConfidence === null ? null : Number(copy.duplicateConfidence),
        duplicateMatchType: copy.duplicateMatchType,
      },
    );
  }
  for (const sibling of links.splitSiblings) {
    await repo.update(
      { workspaceId, id: sibling.id, splitGroupId: IsNull() },
      { splitGroupId: sibling.splitGroupId, splitIndex: sibling.splitIndex },
    );
  }
  if (restored.splitGroupId) {
    await clearLoneSplitParts(manager, workspaceId, [restored.splitGroupId]);
  }
  if (links.reimbursements.length > 0) {
    await repo.update(
      { workspaceId, id: In(links.reimbursements), reimbursementOfId: IsNull() },
      { reimbursementOfId: restored.id },
    );
  }
}

async function clearLoneSplitParts(
  manager: EntityManager,
  workspaceId: string,
  groupIds: string[],
): Promise<void> {
  await manager.query(
    `UPDATE transactions t SET split_group_id = NULL, split_index = NULL
     WHERE t.workspace_id = $1 AND t.split_group_id = ANY($2::uuid[])
       AND NOT EXISTS (
         SELECT 1 FROM transactions sibling
         WHERE sibling.workspace_id = t.workspace_id
           AND sibling.split_group_id = t.split_group_id
           AND sibling.id <> t.id
       )`,
    [workspaceId, groupIds],
  );
}

function distinct(values: Array<string | null>): string[] {
  return [...new Set(values.filter((value): value is string => value !== null))];
}
