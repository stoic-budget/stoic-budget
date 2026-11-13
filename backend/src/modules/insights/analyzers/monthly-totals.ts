import type { Repository } from 'typeorm';
import { flowsSql } from '../../../common/utils/counted-transactions.util';
import { type Transaction, TransactionType } from '../../../entities/transaction.entity';
import { DAY_SQL, type DayRow } from '../../exchange-rates/day-converter';

/** Income and spending of a workspace between two days, per currency and day as booked. */
export function monthlyTotalsByCurrency(
  transactions: Repository<Transaction>,
  workspaceId: string,
  { start, end }: { start: Date; end: Date },
): Promise<Array<DayRow<'income' | 'spent'>>> {
  return transactions
    .createQueryBuilder('t')
    .select('t.currency', 'currency')
    .addSelect(DAY_SQL, 'day')
    .addSelect(
      'COALESCE(SUM(CASE WHEN t.transaction_type = :income THEN ABS(t.amount) ELSE 0 END), 0)',
      'income',
    )
    .addSelect(
      'COALESCE(SUM(CASE WHEN t.transaction_type = :expense THEN ABS(t.amount) ELSE 0 END), 0)',
      'spent',
    )
    .where('t.workspace_id = :workspaceId', { workspaceId })
    .andWhere('t.transaction_date >= :start', { start })
    .andWhere('t.transaction_date <= :end', { end })
    .andWhere('t.is_duplicate = false')
    .andWhere('t.transfer_pair_id IS NULL')
    .andWhere(flowsSql('t'))
    .setParameters({ income: TransactionType.INCOME, expense: TransactionType.EXPENSE })
    .groupBy('t.currency')
    .addGroupBy(DAY_SQL)
    .getRawMany<DayRow<'income' | 'spent'>>();
}
