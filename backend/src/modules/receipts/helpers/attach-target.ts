import type { Receipt } from '../../../entities/receipt.entity';
import type { Transaction } from '../../../entities/transaction.entity';

/**
 * The bank row an approval attaches the receipt to: the one picked (`null` is
 * "a new expense"), else the stored suggestion. A suggestion stored before the
 * match left a scan's own row out may still name that row; it is not a bank
 * row to attach to.
 */
export function attachTarget(
  picked: string | null | undefined,
  receipt: Pick<Receipt, 'metadata'>,
  scanTransaction: Pick<Transaction, 'id'> | null,
): string | null {
  if (picked !== undefined) {
    return picked;
  }
  const suggested = receipt.metadata?.transactionMatch?.transactionIds ?? [];
  return suggested.find(id => id !== scanTransaction?.id) ?? null;
}
