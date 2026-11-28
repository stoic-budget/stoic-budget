import type { Repository } from 'typeorm';
import { flowsSql } from '../../common/utils/counted-transactions.util';
import { CategoryType } from '../../entities/category.entity';
import { type Transaction, TransactionType } from '../../entities/transaction.entity';

export interface SpendingRow {
  date: string | Date;
  currency: string | null;
  amount: string;
}

/**
 * The budget's rows between two days, summed per currency and day: spending,
 * less refunds. A refund is income booked to an expense category (the
 * cash-flow report's rule), say a returned purchase not linked as a
 * reimbursement; it takes its amount off the spending. Linked reimbursements
 * are pairs and stay out, as transfers do.
 */
export function spendingRows(
  transactions: Repository<Transaction>,
  workspaceId: string,
  categoryIds: string[],
  start: Date,
  end: Date,
): Promise<SpendingRow[]> {
  return transactions
    .createQueryBuilder('t')
    .select('t.transaction_date', 'date')
    .addSelect('t.currency', 'currency')
    .addSelect(
      `SUM(CASE WHEN t.transaction_type = :expense THEN ABS(t.amount) ELSE -ABS(t.amount) END)`,
      'amount',
    )
    .where('t.workspace_id = :workspaceId', { workspaceId })
    .andWhere('t.category_id IN (:...categoryIds)', { categoryIds })
    .andWhere(
      '(t.transaction_type = :expense OR (t.transaction_type = :income AND EXISTS (SELECT 1 FROM categories c WHERE c.id = t.category_id AND c.type = :expenseCategory)))',
      {
        expense: TransactionType.EXPENSE,
        income: TransactionType.INCOME,
        expenseCategory: CategoryType.EXPENSE,
      },
    )
    .andWhere('t.transaction_date >= :start', { start })
    .andWhere('t.transaction_date <= :end', { end })
    .andWhere('t.is_duplicate = false')
    .andWhere('t.transfer_pair_id IS NULL')
    .andWhere(flowsSql('t'))
    .groupBy('t.transaction_date')
    .addGroupBy('t.currency')
    .getRawMany<SpendingRow>();
}
