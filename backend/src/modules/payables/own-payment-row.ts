import type { EntityManager } from 'typeorm';
import { assertRowsRemovable } from '../../common/utils/tax-lock.util';
import type { Payable } from '../../entities/payable.entity';
import { PayablePayment } from '../../entities/payable-payment.entity';
import { Transaction } from '../../entities/transaction.entity';

/**
 * What follows a payment's deletion, in the same database transaction: the
 * bill's single link moves to a payment still there, `settle` works the bill's
 * totals out again, and a transaction the app booked itself for the payment
 * (paid from a wallet, or cash in hand) is deleted with it. Left behind, that
 * money stays spent, and paying the bill again spends it twice. A bank row the
 * payment was only linked to stays. A row on a filed tax return refuses.
 */
export async function afterPaymentRemoved<T>(
  manager: EntityManager,
  payment: PayablePayment,
  payable: Payable,
  settle: () => Promise<T>,
): Promise<T> {
  const { workspaceId } = payment;
  if (payment.transactionId && payable.linkedTransactionId === payment.transactionId) {
    const remaining = await manager
      .getRepository(PayablePayment)
      .find({ where: { payableId: payable.id, workspaceId } });
    payable.linkedTransactionId = remaining[0]?.transactionId ?? null;
  }
  const own = payment.ownTransaction && payment.transactionId;
  const rows = manager.getRepository(Transaction);
  const where = { workspaceId, id: payment.transactionId ?? '' };
  if (own) {
    await assertRowsRemovable(rows, where);
  }
  const result = await settle();
  if (own) {
    await rows.delete(where);
  }
  return result;
}
