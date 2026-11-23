import type { EventEmitter2 } from '@nestjs/event-emitter';
import { In, IsNull, type Repository } from 'typeorm';
import { type Receipt, ReceiptStatus } from '../../entities/receipt.entity';
import type { Transaction } from '../../entities/transaction.entity';
import type {
  ReceiptApprovedEvent,
  TransactionsPostedEvent,
} from '../notifications/events/notification-events';

/**
 * What follows confirming rows in Review. A confirmed scan row settles its
 * receipt, the way approving the receipt settles the row; otherwise the
 * receipt would still read as waiting. And the rows count from now on, as a
 * bank row does once booked: `transactions.posted` lets budgets warn,
 * subscriptions be detected and linked, and bills settle (#663).
 */
export async function afterApproval(
  receipts: Repository<Receipt>,
  events: EventEmitter2 | undefined,
  workspaceId: string,
  rows: Transaction[],
): Promise<void> {
  const rowByStatement = new Map(
    rows.filter(row => row.statementId).map(row => [row.statementId as string, row.id]),
  );
  if (rowByStatement.size > 0) {
    const scans = await receipts.find({
      select: { id: true, statementId: true },
      where: { workspaceId, statementId: In([...rowByStatement.keys()]), transactionId: IsNull() },
    });
    for (const receipt of scans) {
      const transactionId = rowByStatement.get(receipt.statementId as string) as string;
      await receipts.update(
        { id: receipt.id, workspaceId },
        { status: ReceiptStatus.APPROVED, transactionId },
      );
      events?.emit('receipt.approved', {
        workspaceId,
        receiptId: receipt.id,
        transactionId,
        mode: 'confirmed_scan',
      } satisfies ReceiptApprovedEvent);
    }
  }
  if (rows.length > 0) {
    events?.emit('transactions.posted', {
      workspaceId,
      transactionIds: rows.map(row => row.id),
    } satisfies TransactionsPostedEvent);
  }
}
