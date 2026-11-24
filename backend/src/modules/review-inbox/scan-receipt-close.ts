import type { EventEmitter2 } from '@nestjs/event-emitter';
import { type EntityManager, IsNull } from 'typeorm';
import { Receipt, ReceiptStatus } from '../../entities/receipt.entity';
import { Transaction } from '../../entities/transaction.entity';
import { hasDecidedCategory } from '../classification/engine/category-decision';
import type { ReceiptApprovedEvent } from '../notifications/events/notification-events';

/**
 * Which row a scan's receipt stands for once its row is confirmed in Review
 * (#687), as approving on the receipt page decides it. When the receipt was
 * matched to a bank row already in the books, that row is the real payment:
 * it is confirmed, takes the category picked in Review unless a person or a
 * rule chose one, the scan's row becomes its duplicate, and the receipt
 * documents the bank row. Otherwise the scan's own row is it.
 *
 * The match is checked again, under a lock on the bank row, since Review
 * never shows it: it must still be a live row of the workspace (not a copy, a
 * transfer leg, a split part, or on a trashed statement) that no other
 * receipt documents, and the scan's row must not be on a filed return.
 */
async function scanReceiptTarget(
  tx: EntityManager,
  workspaceId: string,
  receipt: Pick<Receipt, 'id' | 'metadata'>,
  scanRowId: string,
): Promise<{ transactionId: string; mode: 'confirmed_scan' | 'attached_to_bank_row' }> {
  const own = { transactionId: scanRowId, mode: 'confirmed_scan' as const };
  const matched = receipt.metadata?.transactionMatch?.transactionIds?.[0];
  if (!matched || matched === scanRowId) {
    return own;
  }
  const transactions = tx.getRepository(Transaction);
  const bank = await transactions.findOne({
    where: {
      id: matched,
      workspaceId,
      isDuplicate: false,
      transferPairId: IsNull(),
      splitGroupId: IsNull(),
    },
    lock: { mode: 'pessimistic_write' },
  });
  const scan = await transactions.findOne({ where: { id: scanRowId, workspaceId } });
  const taken = await tx
    .getRepository(Receipt)
    .findOne({ where: { transactionId: matched, workspaceId }, select: { id: true } });
  const [trashed] = bank?.statementId
    ? await tx.query(
        'SELECT 1 FROM statements WHERE id = $1 AND workspace_id = $2 AND deleted_at IS NOT NULL',
        [bank.statementId, workspaceId],
      )
    : [];
  if (!bank || !scan || scan.taxLocked || trashed || (taken && taken.id !== receipt.id)) {
    return own;
  }
  await transactions.update(
    { id: scanRowId, workspaceId },
    { isDuplicate: true, duplicateOfId: bank.id },
  );
  const takesCategory = scan.categoryId && !hasDecidedCategory(bank) && !bank.taxLocked;
  await transactions.update(
    { id: bank.id, workspaceId },
    takesCategory
      ? {
          isVerified: true,
          categoryId: scan.categoryId,
          categorySource: scan.categorySource ?? null,
          categoryReason: scan.categoryReason ?? null,
        }
      : { isVerified: true },
  );
  return { transactionId: bank.id, mode: 'attached_to_bank_row' };
}

/** Approves a scan's receipt once its row is confirmed in Review, documenting the right row. */
export async function approveScanReceipt(
  manager: EntityManager,
  workspaceId: string,
  receipt: Pick<Receipt, 'id' | 'metadata'>,
  scanRowId: string,
  eventEmitter?: EventEmitter2,
): Promise<void> {
  // One transaction: two approvals of receipts matched to one bank row queue on its lock.
  const { transactionId, mode } = await manager.transaction(async tx => {
    const target = await scanReceiptTarget(tx, workspaceId, receipt, scanRowId);
    await tx
      .getRepository(Receipt)
      .update(
        { id: receipt.id, workspaceId },
        { status: ReceiptStatus.APPROVED, transactionId: target.transactionId },
      );
    return target;
  });
  eventEmitter?.emit('receipt.approved', {
    workspaceId,
    receiptId: receipt.id,
    transactionId,
    mode,
  } satisfies ReceiptApprovedEvent);
}
