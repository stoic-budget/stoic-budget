import { type EntityManager, In, type Repository } from 'typeorm';
import { assertRowsRemovable } from '../../common/utils/tax-lock.util';
import type { Payable } from '../../entities/payable.entity';
import { PayablePayment } from '../../entities/payable-payment.entity';
import { Transaction } from '../../entities/transaction.entity';

/**
 * What follows a payment's deletion, in the same database transaction: the
 * bill's single link moves to a payment still there, `settle` works the bill's
 * totals out again, and the transaction the app booked itself for the payment
 * (paid from a wallet, or cash in hand) is deleted with it — left behind, that
 * money stays spent, and paying the bill again spends it twice.
 *
 * Only a row that is still the app's is deleted: no statement (never a bank
 * row), all its split parts with it, and none with loan interest split off
 * (left as it is). Rows flagged as its copies count again. A row on a filed
 * tax return refuses the undo.
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
  const rows = manager.getRepository(Transaction);
  const ids =
    payment.ownTransaction && payment.transactionId
      ? await ownRows(rows, workspaceId, payment.transactionId)
      : [];
  if (ids.length > 0) {
    await assertRowsRemovable(rows, { workspaceId, id: In(ids) });
  }
  const result = await settle();
  if (ids.length > 0) {
    const copies = await rows.find({
      select: { id: true },
      where: { workspaceId, duplicateOfId: In(ids) },
    });
    await rows.delete({ workspaceId, id: In(ids) });
    if (copies.length > 0) {
      await rows.update(
        { workspaceId, id: In(copies.map(copy => copy.id)) },
        {
          isDuplicate: false,
          duplicateOfId: null,
          duplicateConfidence: null,
          duplicateMatchType: null,
        },
      );
    }
  }
  return result;
}

/** The row and its split parts, while every one is still the app's own; none otherwise. */
async function ownRows(
  rows: Repository<Transaction>,
  workspaceId: string,
  id: string,
): Promise<string[]> {
  const row = await rows.findOne({ where: { workspaceId, id } });
  if (!row) return [];
  const parts = row.splitGroupId
    ? await rows.find({ where: { workspaceId, splitGroupId: row.splitGroupId } })
    : [row];
  if (parts.some(part => part.statementId !== null)) return [];
  const ids = parts.map(part => part.id);
  const interest = await rows.count({ where: { workspaceId, loanInterestOfId: In(ids) } });
  return interest > 0 ? [] : ids;
}
