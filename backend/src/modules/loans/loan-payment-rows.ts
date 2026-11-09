import { In, type Repository } from 'typeorm';
import { toMinor } from '../../common/utils/money.util';
import { Transaction, TransactionType } from '../../entities/transaction.entity';
import { type PaymentPlan, planPayments } from './engine/loan-payment-planner';
import { buildSchedule, type LoanPlanInput } from './engine/loan-plan';

export const toDay = (value: string | Date): string =>
  typeof value === 'string' ? value.slice(0, 10) : value.toISOString().slice(0, 10);

/** The money of a row, wherever it is kept. */
export const amountOf = (row: Pick<Transaction, 'amount' | 'debit' | 'credit'>): number =>
  Number(row.amount ?? row.credit ?? row.debit ?? 0);

/**
 * The payments into a loan account: its incoming rows, paired with a transfer
 * leg or not, that are not suspected duplicates, not on a statement in the
 * trash, and not interest split off another payment. Rows still in Review
 * are listed too: a split made now counts once the payment is confirmed.
 */
export function loadPayments(
  transactions: Repository<Transaction>,
  workspaceId: string,
  walletId: string,
): Promise<Transaction[]> {
  return transactions
    .createQueryBuilder('t')
    .where('t.workspaceId = :workspaceId', { workspaceId })
    .andWhere('t.walletId = :walletId', { walletId })
    .andWhere('t.transactionType = :income', { income: TransactionType.INCOME })
    .andWhere('t.isDuplicate = false')
    .andWhere('t.loanInterestOfId IS NULL')
    .andWhere(
      'NOT EXISTS (SELECT 1 FROM statements trashed WHERE trashed.id = t.statementId AND trashed.deleted_at IS NOT NULL)',
    )
    .orderBy('t.transactionDate', 'DESC')
    .addOrderBy('t.createdAt', 'DESC')
    .getMany();
}

export interface PaymentInterest {
  /** The interest row, or part 0 of it when it was split. */
  id: string;
  /** Every row of the interest: the whole, or each part of it. */
  rows: Transaction[];
  minor: number;
}

/** The interest split off each payment, by payment id. Every part of split interest keeps the link. */
export async function loadInterest(
  transactions: Repository<Transaction>,
  workspaceId: string,
  paymentIds: string[],
): Promise<Map<string, PaymentInterest>> {
  const interest = new Map<string, PaymentInterest>();
  if (paymentIds.length === 0) {
    return interest;
  }
  const linked = await transactions.find({
    where: { workspaceId, loanInterestOfId: In(paymentIds) },
    order: { splitIndex: { direction: 'ASC', nulls: 'FIRST' } },
  });
  for (const row of linked) {
    const paymentId = row.loanInterestOfId as string;
    const entry = interest.get(paymentId) ?? { id: row.id, rows: [], minor: 0 };
    entry.rows.push(row);
    entry.minor += toMinor(amountOf(row));
    interest.set(paymentId, entry);
  }
  return interest;
}

/** The schedule's division of each payment. */
export function planOfPayments(
  input: LoanPlanInput,
  currency: string,
  payments: Transaction[],
): Map<string, PaymentPlan> {
  return planPayments(
    buildSchedule(input).rows,
    payments.map(row => ({
      id: row.id,
      date: toDay(row.transactionDate),
      amount: amountOf(row),
      currency: row.currency,
    })),
    { currency, startDate: input.startDate },
  );
}
