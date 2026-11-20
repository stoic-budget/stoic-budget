import type { Repository } from 'typeorm';
import { onlyCounted } from '../../common/utils/counted-transactions.util';
import { PRIVACY_VIEWER_PARAM, redactedSql } from '../../common/utils/transaction-privacy.util';
import { Statement, StatementStatus } from '../../entities/statement.entity';
import type { Transaction } from '../../entities/transaction.entity';
import type { Wallet } from '../../entities/wallet.entity';
import { CurrencyConverter, normalizeCurrencyCode } from '../exchange-rates/currency-converter';
import type { ExchangeRatesService } from '../exchange-rates/exchange-rates.service';
import {
  addDays,
  BOOKED_LATER_WINDOW_DAYS,
  type CoveredSpan,
  coverageEnd,
  type LaterRow,
  round2,
} from './balance-check-reasons';
import { toDateOnly } from './wallet-ledger';

/** Statements whose rows are read and real; the same set the reconciliation dot trusts. */
const LIVE_STATEMENT_STATUSES = [
  StatementStatus.PARSED,
  StatementStatus.VALIDATED,
  StatementStatus.COMPLETED,
];

const NOT_TRASHED = (alias: string) =>
  `NOT EXISTS (SELECT 1 FROM statements trashed WHERE trashed.id = ${alias}.statementId AND trashed.deleted_at IS NOT NULL)`;

type Scope = { workspaceId: string; wallet: Pick<Wallet, 'id' | 'currency'>; date: string };

/** Rows of one account in some state, summed per currency and day, converted into its currency. */
async function sumInAccountCurrency(
  exchangeRates: ExchangeRatesService,
  { workspaceId, wallet }: Scope,
  rows: Array<{ currency: string; date: string | Date; net: string; count: string }>,
): Promise<{ count: number; amount: number }> {
  const target = normalizeCurrencyCode(wallet.currency);
  const own = rows.map(row => ({
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
  return {
    count: own.reduce((sum, row) => sum + row.count, 0),
    amount: round2(
      own.reduce((sum, row) => sum + converter.convert(row.net, row.currency, row.date), 0),
    ),
  };
}

/**
 * Rows of the account up to the day, not yet counted: still in Review, or set
 * aside as possible duplicates. Everyone's rows count, as in the balance;
 * only amounts leave here, never a merchant.
 */
export async function uncountedUpTo(
  transactions: Repository<Transaction>,
  exchangeRates: ExchangeRatesService,
  scope: Scope,
  state: 'in_review' | 'duplicates',
): Promise<{ count: number; amount: number }> {
  const query = transactions
    .createQueryBuilder('t')
    .select('t.currency', 'currency')
    .addSelect('t.transactionDate', 'date')
    .addSelect('COALESCE(SUM(t.credit), 0) - COALESCE(SUM(t.debit), 0)', 'net')
    .addSelect('COUNT(*)', 'count')
    .where('t.workspaceId = :workspaceId', { workspaceId: scope.workspaceId })
    .andWhere('t.walletId = :walletId', { walletId: scope.wallet.id })
    .andWhere('t.transactionDate <= :date', { date: scope.date })
    .andWhere(NOT_TRASHED('t'));
  if (state === 'in_review') {
    query.andWhere('t.isVerified = false').andWhere('t.isDuplicate = false');
  } else {
    query.andWhere('t.isDuplicate = true');
  }
  const rows = await query
    .groupBy('t.currency')
    .addGroupBy('t.transactionDate')
    .getRawMany<{ currency: string; date: string | Date; net: string; count: string }>();
  return sumInAccountCurrency(exchangeRates, scope, rows);
}

/**
 * Currencies of counted rows up to the day with no rate to the account's
 * currency on their day: left out of our balance, so a difference may be
 * them, and booking it would count them twice once the rate arrives.
 */
export async function unconvertedUpTo(
  transactions: Repository<Transaction>,
  exchangeRates: ExchangeRatesService,
  scope: Scope,
): Promise<string[]> {
  const rows = await onlyCounted(
    transactions
      .createQueryBuilder('t')
      .select('t.currency', 'currency')
      .addSelect('t.transactionDate', 'date')
      .where('t.workspaceId = :workspaceId', { workspaceId: scope.workspaceId })
      .andWhere('t.walletId = :walletId', { walletId: scope.wallet.id })
      .andWhere('t.transactionDate <= :date', { date: scope.date })
      .andWhere('UPPER(TRIM(t.currency)) <> UPPER(TRIM(:own))', { own: scope.wallet.currency }),
    't',
  )
    .groupBy('t.currency')
    .addGroupBy('t.transactionDate')
    .getRawMany<{ currency: string; date: string | Date }>();
  const needed = rows.map(row => ({
    currency: normalizeCurrencyCode(row.currency),
    date: toDateOnly(row.date) as string,
  }));
  const converter = await CurrencyConverter.load(
    exchangeRates,
    normalizeCurrencyCode(scope.wallet.currency),
    needed,
    scope.workspaceId,
  );
  for (const row of needed) {
    converter.convert(1, row.currency, row.date);
  }
  return converter.missing;
}

/**
 * Counted rows dated in the few days after the day, oldest first, each in the
 * account's currency; another member's private row under the placeholder.
 */
export async function rowsJustAfter(
  transactions: Repository<Transaction>,
  exchangeRates: ExchangeRatesService,
  scope: Scope,
  viewerMemberId: string | null,
): Promise<LaterRow[]> {
  const rows = await onlyCounted(
    transactions
      .createQueryBuilder('t')
      .select('t.id', 'id')
      .addSelect('t.transactionDate', 'date')
      .addSelect('t.currency', 'currency')
      .addSelect('COALESCE(t.credit, 0) - COALESCE(t.debit, 0)', 'net')
      .addSelect(redactedSql('t', 't.counterparty_name'), 'payee')
      .where('t.workspaceId = :workspaceId', { workspaceId: scope.workspaceId })
      .andWhere('t.walletId = :walletId', { walletId: scope.wallet.id })
      .andWhere('t.transactionDate > :date', { date: scope.date })
      .andWhere('t.transactionDate <= :until', {
        until: addDays(scope.date, BOOKED_LATER_WINDOW_DAYS),
      })
      .setParameter(PRIVACY_VIEWER_PARAM, viewerMemberId),
    't',
  )
    .orderBy('t.transactionDate', 'ASC')
    .addOrderBy('t.createdAt', 'ASC')
    .addOrderBy('t.id', 'ASC')
    .getRawMany<{
      id: string;
      date: string | Date;
      currency: string;
      net: string;
      payee: string;
    }>();

  const target = normalizeCurrencyCode(scope.wallet.currency);
  const listed = rows.map(row => ({
    ...row,
    currency: normalizeCurrencyCode(row.currency),
    date: toDateOnly(row.date) as string,
  }));
  const converter = await CurrencyConverter.load(
    exchangeRates,
    target,
    listed.filter(row => row.currency !== target),
    scope.workspaceId,
  );
  return listed.map(row => ({
    id: row.id,
    date: row.date,
    payee: row.payee ?? '',
    amount: round2(converter.convert(Number(row.net) || 0, row.currency, row.date)),
  }));
}

/**
 * What the account's statements cover, and whether any row of the account
 * (from any source) was booked after the last one, up to the day.
 */
export async function statementCoverage(
  statements: Repository<Statement>,
  transactions: Repository<Transaction>,
  scope: Scope,
): Promise<{ spans: CoveredSpan[]; rowsAfterCoverage: boolean }> {
  const found = await statements
    .createQueryBuilder('statement')
    .select(['statement.id', 'statement.statementDateFrom', 'statement.statementDateTo'])
    .where('statement.workspaceId = :workspaceId', { workspaceId: scope.workspaceId })
    .andWhere('statement.walletId = :walletId', { walletId: scope.wallet.id })
    .andWhere('statement.deletedAt IS NULL')
    .andWhere('statement.statementDateFrom IS NOT NULL')
    .andWhere('statement.statementDateTo IS NOT NULL')
    .andWhere('statement.status IN (:...statuses)', { statuses: LIVE_STATEMENT_STATUSES })
    // A bank's statement covers a period or states a balance; a one-day
    // document without one (an expense typed in, a scanned receipt) covers nothing.
    .andWhere(
      '(statement.statementDateTo > statement.statementDateFrom OR statement.balanceEnd IS NOT NULL OR statement.balanceStart IS NOT NULL)',
    )
    .getMany();
  const spans = found.flatMap(statement => {
    const from = toDateOnly(statement.statementDateFrom);
    const to = toDateOnly(statement.statementDateTo);
    return from && to ? [{ from, to }] : [];
  });
  const end = coverageEnd(spans, scope.date);
  if (end === null || end >= scope.date) {
    return { spans, rowsAfterCoverage: false };
  }
  const rowsAfterCoverage = await transactions
    .createQueryBuilder('t')
    .where('t.workspaceId = :workspaceId', { workspaceId: scope.workspaceId })
    .andWhere('t.walletId = :walletId', { walletId: scope.wallet.id })
    .andWhere('t.transactionDate > :end', { end })
    .andWhere('t.transactionDate <= :date', { date: scope.date })
    .andWhere(NOT_TRASHED('t'))
    .getExists();
  return { spans, rowsAfterCoverage };
}
