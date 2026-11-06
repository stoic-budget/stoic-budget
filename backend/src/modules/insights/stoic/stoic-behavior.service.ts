import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { flowsSql } from '../../../common/utils/counted-transactions.util';
import {
  PRIVACY_VIEWER_PARAM,
  readablePrivateSql,
} from '../../../common/utils/transaction-privacy.util';
import {
  Subscription,
  SubscriptionFrequency,
  SubscriptionStatus,
} from '../../../entities/subscription.entity';
import { Transaction, TransactionType } from '../../../entities/transaction.entity';
import { RESERVE_WALLET_TYPES } from '../../../entities/wallet.entity';
import { computeMonthRange, toMonthKey } from '../../budgets/budget-period.util';
import { spendableBalance } from '../../dashboard/opening-balance';
import { ExchangeRatesService } from '../../exchange-rates/exchange-rates.service';
import { buildRateMap, convertWith, round2 } from '../../goals/goal-money.util';
import { unconfirmedRowsQuery } from '../../review-inbox/review-queue.queries';

export interface MerchantMonth {
  /** The payee's name when the row has one, so one shop under two bank spellings is one. */
  name: string;
  /** The bank's own text carrying most of the money: what the reports list by. */
  bankName: string;
  /** The category most of this merchant's spending was filed under. */
  categoryId: string | null;
  count: number;
  total: number;
}

export interface CashFlowMonth {
  /** `YYYY-MM`. */
  month: string;
  income: number;
  expense: number;
}

/**
 * How the money was spent rather than on what: which merchants, how often,
 * on which days, against which income. The dashboard shows the same raw
 * material; the Stoic analyzer reads it for habits.
 */
export interface StoicBehavior {
  /** Expense per merchant in the judged month. */
  merchants: MerchantMonth[];
  /** Purchase count per merchant in the month before it. */
  previousCounts: Record<string, number>;
  /** Weekend (Sat–Sun) and total expense per category in the judged month. */
  weekendByCategory: Record<string, number>;
  totalByCategory: Record<string, number>;
  /** The judged month and the seven before it, newest first. */
  cashFlow: CashFlowMonth[];
  subscriptions: { count: number; monthlyTotal: number };
  /** Rows of the judged month still waiting in Review, which no figure counts yet. */
  unconfirmedRows: number;
}

const MONTHLY_FACTOR: Record<SubscriptionFrequency, number> = {
  [SubscriptionFrequency.WEEKLY]: 52 / 12,
  [SubscriptionFrequency.MONTHLY]: 1,
  [SubscriptionFrequency.QUARTERLY]: 1 / 3,
  [SubscriptionFrequency.ANNUAL]: 1 / 12,
};

/** The judged month and seven before it: enough for two finished quarters side by side. */
const CASH_FLOW_MONTHS = 8;

const MERCHANT_NAME_SQL = 'COALESCE(payee.name, t.counterparty_name)';

@Injectable()
export class StoicBehaviorService {
  constructor(
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    @InjectRepository(Subscription)
    private readonly subscriptionRepository: Repository<Subscription>,
    private readonly exchangeRatesService: ExchangeRatesService,
  ) {}

  /** Everything for the month that starts at `monthStart`, converted to `currency`. */
  async load(workspaceId: string, currency: string, monthStart: Date): Promise<StoicBehavior> {
    const month = computeMonthRange(monthStart);
    const previous = computeMonthRange(
      new Date(monthStart.getFullYear(), monthStart.getMonth() - 1, 1),
    );
    const flowStart = new Date(
      monthStart.getFullYear(),
      monthStart.getMonth() - (CASH_FLOW_MONTHS - 1),
      1,
    );

    // Advice is the workspace's and names merchants, so nobody's private rows
    // feed the merchant lists; their money still counts in every total below.
    const named = readablePrivateSql('t');
    const nobody = { [PRIVACY_VIEWER_PARAM]: null };
    const [
      merchantRows,
      currentCounts,
      previousRows,
      weekdayRows,
      flowRows,
      subscriptions,
      unconfirmedRows,
    ] = await Promise.all([
      this.expenses(workspaceId, month)
        .andWhere(named, nobody)
        .leftJoin('t.payee', 'payee')
        .select(MERCHANT_NAME_SQL, 'name')
        .addSelect('t.counterparty_name', 'bankName')
        .addSelect('t.category_id', 'categoryId')
        .addSelect('t.currency', 'currency')
        .addSelect('COALESCE(SUM(ABS(t.amount)), 0)', 'total')
        .groupBy(MERCHANT_NAME_SQL)
        .addGroupBy('t.counterparty_name')
        .addGroupBy('t.category_id')
        .addGroupBy('t.currency')
        .getRawMany<{
          name: string;
          bankName: string;
          categoryId: string | null;
          currency: string;
          total: string;
        }>(),
      this.purchaseCounts(workspaceId, month),
      this.purchaseCounts(workspaceId, previous),
      this.expenses(workspaceId, month)
        .select('t.category_id', 'categoryId')
        .addSelect('t.currency', 'currency')
        .addSelect('EXTRACT(ISODOW FROM t.transaction_date) IN (6, 7)', 'weekend')
        .addSelect('COALESCE(SUM(ABS(t.amount)), 0)', 'total')
        .groupBy('t.category_id')
        .addGroupBy('t.currency')
        .addGroupBy('EXTRACT(ISODOW FROM t.transaction_date) IN (6, 7)')
        .getRawMany<{
          categoryId: string | null;
          currency: string;
          weekend: boolean;
          total: string;
        }>(),
      this.transactionRepository
        .createQueryBuilder('t')
        .select("to_char(t.transaction_date, 'YYYY-MM')", 'month')
        .addSelect('t.transaction_type', 'type')
        .addSelect('t.currency', 'currency')
        .addSelect('COALESCE(SUM(ABS(t.amount)), 0)', 'total')
        .where('t.workspace_id = :workspaceId', { workspaceId })
        .andWhere('t.is_duplicate = false')
        .andWhere('t.transfer_pair_id IS NULL')
        .andWhere(flowsSql('t'))
        .andWhere('t.transaction_date >= :start', { start: flowStart })
        .andWhere('t.transaction_date <= :end', { end: month.end })
        .groupBy("to_char(t.transaction_date, 'YYYY-MM')")
        .addGroupBy('t.transaction_type')
        .addGroupBy('t.currency')
        .getRawMany<{ month: string; type: TransactionType; currency: string; total: string }>(),
      this.subscriptionRepository.find({
        // A detected one is only a guess until the person confirms it in Review.
        where: { workspaceId, status: SubscriptionStatus.ACTIVE },
        select: {
          id: true,
          amount: true,
          currency: true,
          frequency: true,
        },
      }),
      unconfirmedRowsQuery(this.transactionRepository, workspaceId)
        .andWhere('t.transactionDate >= :start', { start: month.start })
        .andWhere('t.transactionDate <= :end', { end: month.end })
        .getCount(),
    ]);

    const rates = await buildRateMap(
      this.exchangeRatesService,
      [
        ...merchantRows.map(row => row.currency),
        ...weekdayRows.map(row => row.currency),
        ...flowRows.map(row => row.currency),
        ...subscriptions.map(item => item.currency),
      ],
      currency,
      workspaceId,
    );

    return {
      merchants: this.mergeMerchants(merchantRows, currentCounts, rates),
      previousCounts: Object.fromEntries(
        previousRows.map(row => [row.name, Number.parseInt(row.count, 10) || 0]),
      ),
      ...this.splitWeekend(weekdayRows, rates),
      cashFlow: this.cashFlow(flowRows, rates, monthStart),
      subscriptions: {
        count: subscriptions.length,
        monthlyTotal: round2(
          subscriptions.reduce(
            (sum, item) =>
              sum + convertWith(rates, item.amount, item.currency) * MONTHLY_FACTOR[item.frequency],
            0,
          ),
        ),
      },
      unconfirmedRows,
    };
  }

  /**
   * The money to fall back on today, in `currency`: everyday accounts, savings and
   * deposits, less what the cards owe. Without any account, `fallback`.
   */
  async reserve(workspaceId: string, currency: string, fallback: number): Promise<number> {
    return spendableBalance(this.transactionRepository, workspaceId, {
      walletTypes: RESERVE_WALLET_TYPES,
      convert: async (amount, from) =>
        convertWith(
          await buildRateMap(this.exchangeRatesService, [from], currency, workspaceId),
          amount,
          from,
        ),
      allTime: async () => fallback,
    });
  }

  /** Purchases per merchant in a month. The parts of a split are one purchase. */
  private purchaseCounts(workspaceId: string, range: { start: Date; end: Date }) {
    return this.expenses(workspaceId, range)
      .andWhere(readablePrivateSql('t'), { [PRIVACY_VIEWER_PARAM]: null })
      .leftJoin('t.payee', 'payee')
      .select(MERCHANT_NAME_SQL, 'name')
      .addSelect('COUNT(DISTINCT COALESCE(t.split_group_id::text, t.id::text))', 'count')
      .groupBy(MERCHANT_NAME_SQL)
      .getRawMany<{ name: string; count: string }>();
  }

  private expenses(workspaceId: string, range: { start: Date; end: Date }) {
    return this.transactionRepository
      .createQueryBuilder('t')
      .where('t.workspace_id = :workspaceId', { workspaceId })
      .andWhere('t.transaction_type = :type', { type: TransactionType.EXPENSE })
      .andWhere('t.is_duplicate = false')
      .andWhere('t.transfer_pair_id IS NULL')
      .andWhere(flowsSql('t'))
      .andWhere('t.transaction_date >= :start', { start: range.start })
      .andWhere('t.transaction_date <= :end', { end: range.end });
  }

  /** One row per merchant, filed under the category that carried most of its money. */
  private mergeMerchants(
    rows: Array<{
      name: string;
      bankName: string;
      categoryId: string | null;
      currency: string;
      total: string;
    }>,
    counts: Array<{ name: string; count: string }>,
    rates: Map<string, number>,
  ): MerchantMonth[] {
    const byName = new Map<
      string,
      {
        total: number;
        byCategory: Map<string | null, number>;
        byBankName: Map<string, number>;
      }
    >();
    for (const row of rows) {
      const entry = byName.get(row.name) ?? {
        total: 0,
        byCategory: new Map(),
        byBankName: new Map(),
      };
      const amount = convertWith(rates, row.total, row.currency);
      entry.total += amount;
      entry.byCategory.set(row.categoryId, (entry.byCategory.get(row.categoryId) ?? 0) + amount);
      entry.byBankName.set(row.bankName, (entry.byBankName.get(row.bankName) ?? 0) + amount);
      byName.set(row.name, entry);
    }
    const countOf = new Map(counts.map(row => [row.name, Number.parseInt(row.count, 10) || 0]));
    return [...byName].map(([name, entry]) => ({
      name,
      bankName: [...entry.byBankName].sort((a, b) => b[1] - a[1])[0]?.[0] ?? name,
      categoryId: [...entry.byCategory].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null,
      count: countOf.get(name) ?? 0,
      total: round2(entry.total),
    }));
  }

  private splitWeekend(
    rows: Array<{ categoryId: string | null; currency: string; weekend: boolean; total: string }>,
    rates: Map<string, number>,
  ): Pick<StoicBehavior, 'weekendByCategory' | 'totalByCategory'> {
    const weekendByCategory: Record<string, number> = {};
    const totalByCategory: Record<string, number> = {};
    for (const row of rows) {
      const key = row.categoryId ?? 'none';
      const amount = convertWith(rates, row.total, row.currency);
      totalByCategory[key] = round2((totalByCategory[key] ?? 0) + amount);
      if (row.weekend === true || String(row.weekend) === 'true') {
        weekendByCategory[key] = round2((weekendByCategory[key] ?? 0) + amount);
      }
    }
    return { weekendByCategory, totalByCategory };
  }

  private cashFlow(
    rows: Array<{ month: string; type: TransactionType; currency: string; total: string }>,
    rates: Map<string, number>,
    monthStart: Date,
  ): CashFlowMonth[] {
    return Array.from({ length: CASH_FLOW_MONTHS }, (_, monthsAgo) => {
      const key = toMonthKey(
        new Date(monthStart.getFullYear(), monthStart.getMonth() - monthsAgo, 1),
      );
      const sum = (type: TransactionType) =>
        round2(
          rows
            .filter(row => row.month === key && row.type === type)
            .reduce((total, row) => total + convertWith(rates, row.total, row.currency), 0),
        );
      return {
        month: key,
        income: sum(TransactionType.INCOME),
        expense: sum(TransactionType.EXPENSE),
      };
    });
  }
}
