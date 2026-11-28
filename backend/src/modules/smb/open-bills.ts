import type { Repository } from 'typeorm';
import { type Payable, PayableStatus } from '../../entities/payable.entity';
import type { PayablesService } from '../payables/payables.service';

/** Bills the reconciliation still matches bank rows against, a partly paid one too. */
export const OPEN_STATUSES = [
  PayableStatus.TO_PAY,
  PayableStatus.SCHEDULED,
  PayableStatus.OVERDUE,
  PayableStatus.PARTIALLY_PAID,
];

/**
 * Settles a bill with the bank row the reconciliation matched. A partly paid
 * bill already carries its first payment's row, so the matched row pays the
 * rest as another payment; any other bill is marked paid by the row.
 */
export async function settleWithRow(
  payables: Repository<Payable>,
  payablesService: PayablesService,
  target: { payableId: string; workspaceId: string; userId: string; transactionId: string },
): Promise<Payable> {
  const { payableId, workspaceId, userId, transactionId } = target;
  const payable = await payables.findOne({ where: { id: payableId, workspaceId } });
  const paid = Number(payable?.paidAmount ?? 0);
  const left = payable ? Number(payable.amount) - paid : 0;
  if (paid > 0 && left > 0) {
    return payablesService.addPayment(payableId, workspaceId, userId, {
      amount: Math.round(left * 100) / 100,
      linkedTransactionId: transactionId,
    });
  }
  return payablesService.markAsPaid(payableId, workspaceId, userId, {
    linkedTransactionId: transactionId,
  });
}
