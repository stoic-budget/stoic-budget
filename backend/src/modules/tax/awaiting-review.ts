import { Between, IsNull, Raw, type Repository } from 'typeorm';
import type { Transaction } from '../../entities/transaction.entity';

/**
 * Rows of the period with tax that still wait in Review: unconfirmed, they are
 * not in the return. Filing without them leaves their VAT out, so the return
 * page says how many there are. Zero-tax rows are left out (approving them
 * changes nothing), as are pending bank holds, transfers, rows on a trashed
 * statement and suspected duplicates (a duplicate Review keeps stays out).
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
      // Only rows whose approval changes the return: tax, or reverse charge.
      taxAmount: Raw(column => {
        // Raw hands over `Alias.taxAmount`, unquoted and by property name.
        const alias = `"${column.split('.')[0].replace(/"/g, '')}"`;
        return `(${alias}."tax_amount" <> 0 OR ${alias}."tax_reverse_charge" = true)`;
      }),
      transactionDate: Between(new Date(periodStart), new Date(periodEnd)),
    })),
  });
}

/**
 * Counted rows of the period with no category: no tax is worked out for a
 * row without one, so it enters neither box of the return and nothing else
 * says so (#669). Transfers, pending holds, duplicates and trashed
 * statements are left out, as the return leaves them out.
 */
export function countUncategorized(
  transactions: Repository<Transaction>,
  workspaceId: string,
  periodStart: string,
  periodEnd: string,
): Promise<number> {
  return transactions.count({
    where: [{ statementId: IsNull() }, { statement: { deletedAt: IsNull() } }].map(onStatement => ({
      ...onStatement,
      workspaceId,
      isVerified: true,
      isDuplicate: false,
      isPending: false,
      transferPairId: IsNull(),
      categoryId: IsNull(),
      transactionDate: Between(new Date(periodStart), new Date(periodEnd)),
    })),
  });
}

/** What the return of a period leaves out, for its warnings. */
export async function returnGaps(
  transactions: Repository<Transaction>,
  workspaceId: string,
  periodStart: string,
  periodEnd: string,
): Promise<{ awaitingReview: number; uncategorized: number }> {
  const [awaitingReview, uncategorized] = await Promise.all([
    countAwaitingReview(transactions, workspaceId, periodStart, periodEnd),
    countUncategorized(transactions, workspaceId, periodStart, periodEnd),
  ]);
  return { awaitingReview, uncategorized };
}
