import type { Repository } from 'typeorm';
import { onlyFlows } from '../../common/utils/counted-transactions.util';
import { type Transaction, TransactionType } from '../../entities/transaction.entity';
import { sumConverted } from './opening-balance';

/**
 * All-time net of every approved row, converted by `convert`: the dashboard's
 * balance, and the opening balance of a workspace without accounts. Counted as
 * the dashboard's figures are (no duplicates, no transfers between own
 * accounts), except that a row left out of budgets stays: the money moved.
 */
export async function allTimeBalance(
  transactions: Repository<Transaction>,
  workspaceId: string,
  convert: (amount: string, currency: string) => Promise<number>,
): Promise<number> {
  const query = transactions
    .createQueryBuilder('t')
    .leftJoin('t.statement', 's')
    .where('t.workspaceId = :workspaceId', { workspaceId });
  const rows = await onlyFlows(query, 't', { includeExcluded: true })
    .andWhere('t.isDuplicate = false')
    .andWhere('t.transferPairId IS NULL')
    .select([
      't.currency AS currency',
      `COALESCE(SUM(CASE WHEN t.transactionType = :balIncome THEN t.credit WHEN t.transactionType = :balExpense THEN -t.debit ELSE 0 END), 0) AS "balance"`,
    ])
    .setParameter('balIncome', TransactionType.INCOME)
    .setParameter('balExpense', TransactionType.EXPENSE)
    .groupBy('t.currency')
    .getRawMany<{ currency: string; balance: string }>();
  return sumConverted(rows, convert);
}
