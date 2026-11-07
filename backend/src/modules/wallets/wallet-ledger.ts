import type { Repository } from 'typeorm';
import { countedSql, onlyCounted } from '../../common/utils/counted-transactions.util';
import type { Transaction } from '../../entities/transaction.entity';
import { CurrencyConverter, normalizeCurrencyCode } from '../exchange-rates/currency-converter';
import type { ExchangeRatesService } from '../exchange-rates/exchange-rates.service';

/** A row booked in its account's own currency, by column name over `t` and `w`. */
const SAME_CURRENCY_SQL = (row: string) => `UPPER(TRIM(${row}.currency)) = UPPER(TRIM(w.currency))`;

export const toDateOnly = (value: string | Date | null): string | null =>
  value ? new Date(value).toISOString().slice(0, 10) : null;

/** One account's counted rows, in the account's own currency. */
export interface WalletLedger {
  /** Net movement per day the account moved, oldest first. */
  days: Array<{ date: string; net: number }>;
  net: number;
  count: number;
  lastDate: string | null;
  /** Currencies of rows left out for want of a rate on their day, sorted. */
  unconverted: string[];
}

/**
 * Counted rows of each account, summed per day in the account's currency. A
 * row booked in another currency (a card payment abroad) is converted at the
 * rate of its own day, as the bank debits it; one without a rate is left out
 * and its currency listed, never added 1:1.
 */
export async function walletLedgers(
  transactions: Repository<Transaction>,
  exchangeRates: ExchangeRatesService,
  workspaceId: string,
  wallets: Array<{ id: string; currency: string }>,
): Promise<Map<string, WalletLedger>> {
  const ledgers = new Map<string, WalletLedger>();
  if (wallets.length === 0) {
    return ledgers;
  }
  const rows = await onlyCounted(
    transactions
      .createQueryBuilder('transaction')
      .select('transaction.walletId', 'walletId')
      .addSelect('transaction.currency', 'currency')
      .addSelect('transaction.transactionDate', 'date')
      .addSelect(
        'COALESCE(SUM(transaction.credit), 0) - COALESCE(SUM(transaction.debit), 0)',
        'net',
      )
      .addSelect('COUNT(*)', 'count')
      .where('transaction.workspaceId = :workspaceId', { workspaceId })
      .andWhere('transaction.walletId IN (:...walletIds)', {
        walletIds: wallets.map(wallet => wallet.id),
      }),
    'transaction',
  )
    .groupBy('transaction.walletId')
    .addGroupBy('transaction.currency')
    .addGroupBy('transaction.transactionDate')
    .orderBy('transaction.transactionDate', 'ASC')
    .getRawMany<{
      walletId: string;
      currency: string;
      date: string | Date;
      net: string;
      count: string;
    }>();

  for (const wallet of wallets) {
    const target = normalizeCurrencyCode(wallet.currency);
    const own = rows
      .filter(row => row.walletId === wallet.id)
      .map(row => ({
        currency: normalizeCurrencyCode(row.currency),
        date: toDateOnly(row.date) as string,
        net: Number(row.net) || 0,
        count: Number(row.count) || 0,
      }));
    const converter = await CurrencyConverter.load(
      exchangeRates,
      target,
      own.filter(row => row.currency !== target),
      workspaceId,
    );

    const days = new Map<string, number>();
    let count = 0;
    for (const row of own) {
      days.set(
        row.date,
        (days.get(row.date) ?? 0) + converter.convert(row.net, row.currency, row.date),
      );
      count += row.count;
    }
    const list = [...days].map(([date, net]) => ({ date, net }));
    ledgers.set(wallet.id, {
      days: list,
      net: list.reduce((sum, day) => sum + day.net, 0),
      count,
      lastDate: list.length > 0 ? list[list.length - 1].date : null,
      unconverted: converter.missing,
    });
  }
  return ledgers;
}

/**
 * Each listed row's account balance right after it, over every counted row of
 * the account in the order the list shows them (date, then creation), from its
 * opening balance. Rows in another currency are converted as in
 * `walletLedgers`; one without a rate is left out.
 */
export async function runningBalances(
  transactions: Repository<Transaction>,
  exchangeRates: ExchangeRatesService,
  workspaceId: string,
  walletIds: string[],
  rowIds: string[],
): Promise<Map<string, string>> {
  const [own, foreign]: [
    Array<{ id: string; currency: string; running: string }>,
    Array<{ id: string; currency: string; date: string; net: string }>,
  ] = await Promise.all([
    transactions.query(
      `SELECT ledger.id, ledger.currency, ledger.running FROM (
         SELECT t.id, w.currency,
           w.initial_balance + SUM(CASE WHEN ${SAME_CURRENCY_SQL('t')}
             THEN COALESCE(t.credit, 0) - COALESCE(t.debit, 0) ELSE 0 END)
             OVER (PARTITION BY t.wallet_id ORDER BY t.transaction_date, t.created_at, t.id) AS running
         FROM transactions t
         JOIN wallets w ON w.id = t.wallet_id AND w.workspace_id = t.workspace_id
         WHERE t.workspace_id = $1 AND t.wallet_id = ANY($2) AND ${countedSql('t')}
       ) ledger WHERE ledger.id = ANY($3)`,
      [workspaceId, walletIds, rowIds],
    ),
    // The rows in another currency up to each listed row, per currency and day.
    transactions.query(
      `SELECT r.id, f.currency, to_char(f.transaction_date, 'YYYY-MM-DD') AS date,
         SUM(COALESCE(f.credit, 0) - COALESCE(f.debit, 0)) AS net
       FROM transactions r
       JOIN wallets w ON w.id = r.wallet_id AND w.workspace_id = r.workspace_id
       JOIN transactions f ON f.workspace_id = r.workspace_id AND f.wallet_id = r.wallet_id
         AND NOT ${SAME_CURRENCY_SQL('f')}
         AND (f.transaction_date, f.created_at, f.id) <= (r.transaction_date, r.created_at, r.id)
       WHERE r.workspace_id = $1 AND r.id = ANY($2) AND ${countedSql('f')}
       GROUP BY r.id, f.currency, f.transaction_date`,
      [workspaceId, rowIds],
    ),
  ]);

  const running = new Map(own.map(row => [row.id, Number(row.running) || 0]));
  const targets = new Map(own.map(row => [row.id, normalizeCurrencyCode(row.currency)]));
  const converters = new Map<string, CurrencyConverter>();
  for (const target of new Set(targets.values())) {
    const needed = foreign
      .filter(row => targets.get(row.id) === target)
      .map(row => ({ currency: normalizeCurrencyCode(row.currency), date: row.date }));
    converters.set(
      target,
      await CurrencyConverter.load(exchangeRates, target, needed, workspaceId),
    );
  }
  for (const row of foreign) {
    const converter = converters.get(targets.get(row.id) ?? '');
    if (!converter) {
      continue;
    }
    const converted = converter.convert(
      Number(row.net) || 0,
      normalizeCurrencyCode(row.currency),
      row.date,
    );
    running.set(row.id, (running.get(row.id) ?? 0) + converted);
  }
  return new Map([...running].map(([id, balance]) => [id, balance.toFixed(2)]));
}
