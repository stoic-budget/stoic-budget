import type { ReceiptDocument, Transaction } from '../types/statement-types';

/**
 * Income or spending, as the server counts it for the tiles beside these tables
 * (`onlyFlows` with `transferPairId IS NULL`): not a leg of a transfer between
 * own accounts, not a row left out of budgets, and not a crypto row — a swap or
 * a move between own wallets (the server keeps a crypto row only when it
 * settles a bill, which the list does not say).
 */
function isFlow(transaction: Transaction): boolean {
  return (
    !transaction.transferPairId &&
    transaction.excludedFromBudgets !== true &&
    !transaction.cryptoWalletId
  );
}

/**
 * Only what a person confirmed counts in the numbers. A transaction counts once
 * it was confirmed in Review and is no longer pending at the bank; a receipt
 * counts once approved (its transaction
 * then carries it, and the record mappers drop the duplicate).
 */
export function keepConfirmed(data: { transactions: Transaction[]; receipts: ReceiptDocument[] }): {
  transactions: Transaction[];
  receipts: ReceiptDocument[];
} {
  // A receipt of a row that is no income or spending stays out with its row.
  const notFlows = new Set(data.transactions.filter(row => !isFlow(row)).map(row => row.id));
  return {
    transactions: data.transactions.filter(
      transaction =>
        transaction.isVerified === true && transaction.isPending !== true && isFlow(transaction),
    ),
    receipts: data.receipts.filter(
      receipt =>
        receipt.status === 'approved' &&
        !(receipt.transactionId && notFlows.has(receipt.transactionId)),
    ),
  };
}
