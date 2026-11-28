import { Between, In, IsNull, Not, Or, Raw, type Repository } from 'typeorm';
import { countedWhere } from '../../common/utils/counted-transactions.util';
import type { Transaction } from '../../entities/transaction.entity';
import { VatStatus } from '../../entities/workspace.entity';
import { NON_TAXABLE_NATURES } from './tax-assignment.service';

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
 * Counted rows of the period that a category would bring into the return:
 * no category and so no tax worked out, while the workspace is registered for
 * VAT (#669). Rows that keep a hand-picked rate are in the return already;
 * transfers, salary, loans and tax payments are never taxable; zero rows
 * change nothing. The counted rows are the return's own (`countedWhere`).
 */
export function countUncategorized(
  transactions: Repository<Transaction>,
  workspaceId: string,
  periodStart: string,
  periodEnd: string,
): Promise<number> {
  return transactions.count({
    where: countedWhere({
      workspaceId,
      workspace: { vatStatus: VatStatus.REGISTERED },
      transferPairId: IsNull(),
      categoryId: IsNull(),
      taxAmount: IsNull(),
      amount: Not(0),
      transactionNature: Or(IsNull(), Not(In([...NON_TAXABLE_NATURES]))),
      transactionDate: Between(new Date(periodStart), new Date(periodEnd)),
    }),
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
