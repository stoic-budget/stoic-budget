import { Between, IsNull, Not, type Repository } from 'typeorm';
import type { Transaction } from '../../entities/transaction.entity';

/**
 * Rows of the period with tax that still wait in Review: unconfirmed, they are
 * not in the return. Filing without them leaves their VAT out, so the return
 * page says how many there are. Duplicates, pending bank holds, transfers and
 * rows on a trashed statement are not waiting for anything.
 */
export function countAwaitingReview(
  transactions: Repository<Transaction>,
  workspaceId: string,
  periodStart: string,
  periodEnd: string,
): Promise<number> {
  return transactions.count({
    where: [{ statementId: IsNull() }, { statement: { deletedAt: IsNull() } }].map(onStatement => ({
      ...onStatement,
      workspaceId,
      isVerified: false,
      isDuplicate: false,
      isPending: false,
      transferPairId: IsNull(),
      taxAmount: Not(IsNull()),
      transactionDate: Between(new Date(periodStart), new Date(periodEnd)),
    })),
  });
}
