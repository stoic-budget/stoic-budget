import { BadRequestException } from '@nestjs/common';
import { type EntityManager, In } from 'typeorm';
import { appError } from '../../../common/errors/app-error';
import { Payable } from '../../../entities/payable.entity';
import { Receipt } from '../../../entities/receipt.entity';
import { Transaction } from '../../../entities/transaction.entity';
import { TransactionAttachment } from '../../../entities/transaction-attachment.entity';

export interface RepointedLinks {
  duplicates: number;
  receipts: number;
  payables: number;
  attachments: number;
}

export const NOTHING_REPOINTED: RepointedLinks = {
  duplicates: 0,
  receipts: 0,
  payables: 0,
  attachments: 0,
};

/**
 * Moves what hangs on the parts an unsplit is about to delete onto the survivor.
 * Must run BEFORE the delete: the foreign keys at transactions.id null the
 * links (duplicates, receipts, payables) or, for attachments, delete the rows
 * with their files. The survivor represents the whole charge again, so it is
 * the right target for all of them.
 */
export async function repointSplitParts(
  manager: EntityManager,
  workspaceId: string,
  removedIds: string[],
  survivorId: string,
): Promise<RepointedLinks> {
  // Without this, a transaction whose master was a deleted part is left
  // isDuplicate=true with duplicateOfId=null: excluded from reports forever,
  // with no master and no UI path to unflag it. The survivor cannot be
  // repointed at itself here — a row with duplicateOfId set always has
  // isDuplicate set too, which unsplit refuses before getting here.
  const duplicates = await manager
    .getRepository(Transaction)
    .update({ workspaceId, duplicateOfId: In(removedIds) }, { duplicateOfId: survivorId });

  const receipts = await manager
    .getRepository(Receipt)
    .update({ workspaceId, transactionId: In(removedIds) }, { transactionId: survivorId });

  const payables = await manager
    .getRepository(Payable)
    .update(
      { workspaceId, linkedTransactionId: In(removedIds) },
      { linkedTransactionId: survivorId },
    );

  const attachments = await manager
    .getRepository(TransactionAttachment)
    .update({ workspaceId, transactionId: In(removedIds) }, { transactionId: survivorId });

  return {
    duplicates: duplicates.affected ?? 0,
    receipts: receipts.affected ?? 0,
    payables: payables.affected ?? 0,
    attachments: attachments.affected ?? 0,
  };
}

/** Of these rows, the ones a person pinned a file to: kept like an edited row on a reprocess. */
export async function transactionIdsWithAttachments(
  manager: EntityManager,
  workspaceId: string,
  transactionIds: string[],
): Promise<Set<string>> {
  if (transactionIds.length === 0) return new Set();
  const rows = await manager.getRepository(TransactionAttachment).find({
    where: { workspaceId, transactionId: In(transactionIds) },
    select: { id: true, transactionId: true },
  });
  return new Set(rows.map(row => row.transactionId));
}

type Privacy = Pick<Transaction, 'id' | 'isPrivate' | 'ownerMemberId'>;

/** Who can read a row's files: everyone in the workspace, or one member. */
const readersOf = (row: Privacy): string =>
  row.isPrivate ? `member:${row.ownerMemberId}` : 'everyone';

/**
 * Refuses an unsplit that would change who can read a part's files by moving
 * them onto the survivor: a private part's files onto a row others can read
 * (they would see them), or a shared part's files onto a row private to one
 * member (everyone else, the uploader too, would lose them).
 */
export async function assertFilesKeepTheirReaders(
  manager: EntityManager,
  workspaceId: string,
  survivor: Privacy,
  removed: Privacy[],
): Promise<void> {
  const moved = removed.filter(part => readersOf(part) !== readersOf(survivor));
  if (moved.length === 0) return;
  const withFiles = await transactionIdsWithAttachments(
    manager,
    workspaceId,
    moved.map(part => part.id),
  );
  const part = moved.find(item => withFiles.has(item.id));
  if (!part) return;
  throw new BadRequestException(
    appError(
      part.isPrivate ? 'TRANSACTION_UNSPLIT_PRIVATE_FILES' : 'TRANSACTION_UNSPLIT_HIDES_FILES',
    ),
  );
}
