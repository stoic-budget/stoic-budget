import type { EventEmitter2 } from '@nestjs/event-emitter';
import type { EntityManager } from 'typeorm';
import { Receipt, ReceiptStatus } from '../../entities/receipt.entity';
import { Transaction } from '../../entities/transaction.entity';
import type { ReceiptApprovedEvent } from '../notifications/events/notification-events';

/**
 * Which row a scan's receipt stands for once its row is confirmed in Review
 * (#687). When the receipt was matched to a bank row already in the books,
 * that row is the real payment: the scan's row is flagged a duplicate of it,
 * as approving on the receipt page does, and the receipt documents the bank
 * row. Otherwise the scan's own row is it. A match that is gone, already
 * documented by another receipt, or a scan row on a filed return, keeps the
 * scan's row.
 */
async function scanReceiptTarget(
  manager: EntityManager,
  workspaceId: string,
  receipt: Pick<Receipt, 'id' | 'metadata'>,
  scanRowId: string,
): Promise<{ transactionId: string; mode: 'confirmed_scan' | 'attached_to_bank_row' }> {
  const own = { transactionId: scanRowId, mode: 'confirmed_scan' as const };
  const matched = receipt.metadata?.transactionMatch?.transactionIds?.[0];
  if (!matched || matched === scanRowId) {
    return own;
  }
  const transactions = manager.getRepository(Transaction);
  const [bank, scan, taken] = await Promise.all([
    transactions.findOne({ where: { id: matched, workspaceId }, select: { id: true } }),
    transactions.findOne({
      where: { id: scanRowId, workspaceId },
      select: { id: true, taxLocked: true },
    }),
    manager.getRepository(Receipt).findOne({
      where: { transactionId: matched, workspaceId },
      select: { id: true },
    }),
  ]);
  if (!bank || !scan || scan.taxLocked || (taken && taken.id !== receipt.id)) {
    return own;
  }
  await transactions.update(
    { id: scanRowId, workspaceId },
    { isDuplicate: true, duplicateOfId: bank.id },
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
  const { transactionId, mode } = await scanReceiptTarget(manager, workspaceId, receipt, scanRowId);
  await manager
    .getRepository(Receipt)
    .update({ id: receipt.id, workspaceId }, { status: ReceiptStatus.APPROVED, transactionId });
  eventEmitter?.emit('receipt.approved', {
    workspaceId,
    receiptId: receipt.id,
    transactionId,
    mode,
  } satisfies ReceiptApprovedEvent);
}
