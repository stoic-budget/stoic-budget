import type { Transaction } from '../../entities';
import type { TransactionFacts } from './ledger-posting.rules';

/** What the posting rules read of a transaction. */
export function factsOf(tx: Transaction): TransactionFacts {
  return {
    transactionType: tx.transactionType,
    amount: tx.amount,
    debit: tx.debit,
    credit: tx.credit,
    taxAmount: tx.taxAmount,
    taxReverseCharge: tx.taxReverseCharge,
    taxNotionalAmount: tx.taxNotionalAmount,
    isDuplicate: tx.isDuplicate,
    isVerified: tx.isVerified,
    isPending: tx.isPending,
    cryptoWalletId: tx.cryptoWalletId,
    categoryId: tx.categoryId,
    branchId: tx.branchId,
  };
}
