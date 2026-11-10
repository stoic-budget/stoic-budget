import type { Repository } from 'typeorm';
import { onlyFlows } from '../../common/utils/counted-transactions.util';
import { PRIVACY_VIEWER_PARAM, redactedSql } from '../../common/utils/transaction-privacy.util';
import { type Transaction, TransactionType } from '../../entities/transaction.entity';
import { PENDING_MAX_AGE_DAYS } from '../bank-sync/bank-sync-pending';
import type { ForecastEvent } from './forecast.engine';

/** What the forecast reads straight from transactions, beside the dashboard's commitments. */

const INCOME_LOOKBACK_MONTHS = 12;

/** A year of income rows, for the paydays the engine detects. */
export function incomeHistory(
  transactions: Repository<Transaction>,
  workspaceId: string,
  today: Date,
  viewerMemberId: string | null,
) {
  const since = new Date(today.getFullYear(), today.getMonth() - INCOME_LOOKBACK_MONTHS, 1);
  const incomeQuery = transactions
    .createQueryBuilder('t')
    .select([
      `${redactedSql('t', 't.counterparty_name')} AS "counterpartyName"`,
      't.credit AS amount',
      't.transactionDate AS "transactionDate"',
    ])
    .where('t.workspaceId = :workspaceId', {
      workspaceId,
      [PRIVACY_VIEWER_PARAM]: viewerMemberId,
    });
  return onlyFlows(incomeQuery, 't')
    .andWhere('t.transactionType = :income', { income: TransactionType.INCOME })
    .andWhere('t.isDuplicate = false')
    .andWhere('t.transferPairId IS NULL')
    .andWhere('t.transactionDate >= :since', { since })
    .orderBy('t.transactionDate', 'ASC')
    .getRawMany<{
      counterpartyName: string | null;
      amount: string;
      transactionDate: string | Date;
    }>();
}

/**
 * Rows the bank still holds as pending, as money already gone (or come): the
 * card was charged, whatever day the bank books it. They count in no balance,
 * so the opening balance does not hold them yet; placed on today, they take it
 * out of the curve and of safe-to-spend from the first day, and are listed as
 * such. A row of a trashed statement or a suspected duplicate is no money,
 * and neither is a hold older than the bank keeps one: only a pull removes it,
 * and an account no longer pulled would otherwise hold it out forever.
 */
export async function pendingEvents(
  transactions: Repository<Transaction>,
  workspaceId: string,
  today: string,
  viewerMemberId: string | null,
  convert: (amount: number, from: string) => Promise<number>,
): Promise<ForecastEvent[]> {
  const since = new Date(`${today}T00:00:00Z`);
  since.setUTCDate(since.getUTCDate() - PENDING_MAX_AGE_DAYS);
  const rows = await transactions
    .createQueryBuilder('t')
    .select('t.id', 'id')
    // Another member's private row is listed under the placeholder, not its party.
    .addSelect(redactedSql('t', 't.counterparty_name'), 'label')
    .addSelect('t.currency', 'currency')
    .addSelect('t.transactionType', 'type')
    .addSelect('COALESCE(t.amount, t.debit, t.credit, 0)', 'amount')
    .where('t.workspaceId = :workspaceId', { workspaceId, [PRIVACY_VIEWER_PARAM]: viewerMemberId })
    .andWhere('t.isPending = true AND t.isDuplicate = false')
    .andWhere('t.transactionDate >= :pendingSince', {
      pendingSince: since.toISOString().slice(0, 10),
    })
    .andWhere(
      'NOT EXISTS (SELECT 1 FROM statements trashed WHERE trashed.id = t.statementId AND trashed.deleted_at IS NOT NULL)',
    )
    .getRawMany<{
      id: string;
      label: string | null;
      currency: string;
      type: string;
      amount: string;
    }>();

  const events: ForecastEvent[] = [];
  for (const row of rows) {
    const amount = await convert(Math.abs(Number.parseFloat(row.amount)), row.currency);
    if (amount === 0) continue;
    events.push({
      date: today,
      label: row.label ?? '',
      amount: row.type === TransactionType.INCOME ? amount : -amount,
      kind: 'pending',
      sourceId: row.id,
    });
  }
  return events;
}
