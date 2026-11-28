import type { EventEmitter2 } from '@nestjs/event-emitter';
import { In, IsNull, type Repository } from 'typeorm';
import type { Receipt } from '../../entities/receipt.entity';
import type { Transaction } from '../../entities/transaction.entity';
import type { TransactionsPostedEvent } from '../notifications/events/notification-events';
import { approveScanReceipt } from './scan-receipt-close';

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
      select: { id: true, statementId: true, metadata: true },
      where: { workspaceId, statementId: In([...rowByStatement.keys()]), transactionId: IsNull() },
    });
    for (const receipt of scans) {
      // A receipt matched to a bank row documents that row; the scan's is its duplicate (#687).
      const scanRowId = rowByStatement.get(receipt.statementId as string) as string;
      await approveScanReceipt(receipts.manager, workspaceId, receipt, scanRowId, events);
    }
  }
  if (rows.length > 0) {
    events?.emit('transactions.posted', {
      workspaceId,
      transactionIds: rows.map(row => row.id),
    } satisfies TransactionsPostedEvent);
  }
}
