import type { Repository } from 'typeorm';
import { countedSql, onlyFlows } from '../../common/utils/counted-transactions.util';
import {
  PRIVACY_VIEWER_PARAM,
  readablePrivateSql,
} from '../../common/utils/transaction-privacy.util';
import { type Transaction, TransactionType } from '../../entities/transaction.entity';
import { SPENDABLE_WALLET_TYPES } from '../../entities/wallet.entity';
import type { SubscriptionPayments } from './paycheck-commitments';

export interface IncomeHistoryRow {
  counterpartyName: string | null;
  amount: string;
  currency: string | null;
  transactionDate: string;
}

/**
 * Income rows since `since` that count (`onlyFlows`), without transfers.
 * Another member's private rows are left out altogether, not shown under a
 * placeholder: their payer must not become a payday someone else plans on.
 */
export function readIncomeRows(
  repo: Repository<Transaction>,
  workspaceId: string,
  viewerMemberId: string | null,
  since: string,
): Promise<IncomeHistoryRow[]> {
  const query = repo
    .createQueryBuilder('t')
    .select('t.counterparty_name', 'counterpartyName')
    .addSelect('t.credit', 'amount')
    .addSelect('t.currency', 'currency')
    .addSelect("TO_CHAR(t.transaction_date, 'YYYY-MM-DD')", 'transactionDate')
    .where('t.workspace_id = :workspaceId', { workspaceId });
  return onlyFlows(query, 't')
    .andWhere('t.transaction_type = :income', { income: TransactionType.INCOME })
    .andWhere('t.transfer_pair_id IS NULL')
    .andWhere(readablePrivateSql('t'))
    .andWhere('t.transaction_date >= :since', { since })
    .setParameter(PRIVACY_VIEWER_PARAM, viewerMemberId)
    .orderBy('t.transaction_date', 'ASC')
    .getRawMany<IncomeHistoryRow>();
}

export interface AccountRow {
  id: string;
  name: string;
  currency: string;
  balance: string;
}

/** Active spending accounts with today's counted balance, as `spendableBalance` reads them. */
export function readSpendingAccounts(
  repo: Repository<Transaction>,
  workspaceId: string,
): Promise<AccountRow[]> {
  return repo.query(
    `SELECT w.id, w.name, w.currency, w.initial_balance + COALESCE(moved.net, 0) AS balance
       FROM wallets w
       LEFT JOIN (
         SELECT t.wallet_id, SUM(COALESCE(t.credit, 0) - COALESCE(t.debit, 0)) AS net
           FROM transactions t
          WHERE t.workspace_id = $1 AND ${countedSql('t')}
          GROUP BY t.wallet_id
       ) moved ON moved.wallet_id = w.id
      WHERE w.workspace_id = $1 AND w.is_active AND w.type = ANY($2)
      ORDER BY w.name, w.id`,
    [workspaceId, [...SPENDABLE_WALLET_TYPES]],
  );
}

/**
 * Currencies the plan converts besides the accounts and the income: open
 * bills and receivables, active subscriptions, goals still ahead and, with
 * `withBalances`, what the default starting cash sums (as `spendableBalance`
 * does: banks no account holds yet, or every counted row without accounts).
 */
export async function readCommitmentCurrencies(
  repo: Repository<Transaction>,
  workspaceId: string,
  today: string,
  withBalances: boolean,
): Promise<string[]> {
  const balances = withBalances
    ? `UNION
     SELECT DISTINCT s.currency FROM statements s
      WHERE s.workspace_id = $1 AND s.deleted_at IS NULL AND s.balance_end IS NOT NULL
        AND s.status IN ('parsed', 'validated', 'completed') AND s.wallet_id IS NULL
        AND EXISTS (SELECT 1 FROM wallets w WHERE w.workspace_id = $1 AND w.is_active)
        AND NOT EXISTS (
          SELECT 1 FROM transactions held
           WHERE held.statement_id = s.id AND held.wallet_id IS NOT NULL
        )
     UNION
     SELECT DISTINCT t.currency FROM transactions t
      WHERE t.workspace_id = $1 AND ${countedSql('t')}
        AND NOT EXISTS (SELECT 1 FROM wallets w WHERE w.workspace_id = $1 AND w.is_active)`
    : '';
  const rows: Array<{ currency: string | null }> = await repo.query(
    `SELECT DISTINCT currency FROM payables
      WHERE workspace_id = $1 AND deleted_at IS NULL
        AND status IN ('to_pay', 'scheduled', 'overdue', 'partially_paid')
     UNION
     SELECT DISTINCT currency FROM subscriptions WHERE workspace_id = $1 AND status = 'active'
     UNION
     SELECT DISTINCT currency FROM goals
      WHERE workspace_id = $1 AND deleted_at IS NULL AND target_date > $2::date
     ${balances}`,
    [workspaceId, today],
  );
  return rows.map(row => row.currency ?? '').filter(Boolean);
}

/** The payments recorded for each subscription, newest first, to spot a charge paid before its date. */
export async function readSubscriptionPayments(
  repo: Repository<Transaction>,
  workspaceId: string,
  subscriptionIds: string[],
): Promise<Map<string, SubscriptionPayments>> {
  if (subscriptionIds.length === 0) return new Map();
  const rows: Array<{ id: string; dates: string[] | null; frequency: string }> = await repo.query(
    `SELECT s.id, s.frequency::text AS frequency,
            ARRAY_AGG(TO_CHAR(c.charge_date, 'YYYY-MM-DD') ORDER BY c.charge_date DESC)
              FILTER (WHERE c.id IS NOT NULL) AS dates
       FROM subscriptions s
       LEFT JOIN subscription_charges c
         ON c.subscription_id = s.id AND c.workspace_id = s.workspace_id
      WHERE s.workspace_id = $1 AND s.id = ANY($2::uuid[])
      GROUP BY s.id, s.frequency`,
    [workspaceId, subscriptionIds],
  );
  return new Map(
    rows.map(row => [row.id, { paymentDates: row.dates ?? [], frequency: row.frequency }]),
  );
}
