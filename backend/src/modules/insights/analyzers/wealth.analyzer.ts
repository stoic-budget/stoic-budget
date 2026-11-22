import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { InsightCategory, InsightSeverity, InsightType } from '../../../entities/insight.entity';
import { Transaction } from '../../../entities/transaction.entity';
import { Workspace } from '../../../entities/workspace.entity';
import { isoDate, shiftDays } from '../../balance/snapshot-series';
import { hasActiveAccounts, spendableBalance } from '../../dashboard/opening-balance';
import { ExchangeRatesService } from '../../exchange-rates/exchange-rates.service';
import { buildRateMap, convertWith } from '../../goals/goal-money.util';
import { NetWorthService } from '../../net-worth/net-worth.service';
import type { AnalysisContext, InsightAnalyzer, InsightCandidate } from './analyzer.interface';
import { endOfMonth, monthKey, round2 } from './month-bounds';
import { loadSpendingHistory, type SpendingHistory } from './spending-history';
import {
  type CategoryAnomaly,
  crossedMilestone,
  findCategoryAnomalies,
  IDLE_CASH_MONTHS,
  idleCashMonths,
  MIN_SPENDING_MONTHS,
} from './wealth-signals';

/**
 * A milestone is news for this many days after the crossing, then it is
 * history. No longer than a dismissed insight's snooze, so a closed one does
 * not come back while it is still news.
 */
export const MILESTONE_WINDOW_DAYS = 7;

/**
 * Signals about the household's money as a whole, each measured against the
 * household's own spending rather than a fixed amount: cash resting beyond a
 * reserve, net worth passing a round number, a category far above its usual.
 *
 * Privacy: another member's private rows count in every total (the money is
 * the household's, and totals never depend on who looks), but no card names
 * anything about them. Their category is not theirs to show, so they are in
 * no category's history; see `loadSpendingHistory`.
 */
@Injectable()
export class WealthAnalyzer implements InsightAnalyzer {
  constructor(
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    @InjectRepository(Workspace)
    private readonly workspaceRepository: Repository<Workspace>,
    private readonly netWorthService: NetWorthService,
    private readonly exchangeRatesService: ExchangeRatesService,
  ) {}

  async analyze(context: AnalysisContext, now = new Date()): Promise<InsightCandidate[]> {
    const workspaceId = context.workspaceId;
    if (!workspaceId) {
      return [];
    }

    const history = await loadSpendingHistory(
      {
        transactionRepository: this.transactionRepository,
        workspaceRepository: this.workspaceRepository,
        exchangeRatesService: this.exchangeRatesService,
      },
      workspaceId,
      now,
    );
    const enoughHistory = history.household.length >= MIN_SPENDING_MONTHS;
    const monthlySpending = enoughHistory
      ? history.household.reduce((sum, value) => sum + value, 0) / history.household.length
      : 0;

    const [idleCash, milestone] = await Promise.all([
      this.idleCashAdvice(workspaceId, history, monthlySpending, now),
      monthlySpending > 0 ? this.milestoneAdvice(workspaceId, monthlySpending) : null,
    ]);
    const anomalies = findCategoryAnomalies(history).map(anomaly =>
      this.anomalyAdvice(workspaceId, history.currency, anomaly, now),
    );
    return [idleCash, milestone, ...anomalies].filter(
      (item): item is InsightCandidate => item !== null,
    );
  }

  /**
   * Everyday accounts holding more than `IDLE_CASH_MONTHS` of spending. Read
   * only from real accounts: without one the balance is a sum of rows, too
   * rough to tell anyone their money is idle.
   */
  private async idleCashAdvice(
    workspaceId: string,
    history: SpendingHistory,
    monthlySpending: number,
    now: Date,
  ): Promise<InsightCandidate | null> {
    if (
      !(monthlySpending > 0 && (await hasActiveAccounts(this.transactionRepository, workspaceId)))
    ) {
      return null;
    }
    const { currency } = history;
    const cash = await spendableBalance(this.transactionRepository, workspaceId, {
      convert: async (amount, from) =>
        convertWith(
          await buildRateMap(this.exchangeRatesService, [from], currency, workspaceId),
          amount,
          from,
        ),
      allTime: async () => 0,
    });
    const months = idleCashMonths({
      cash,
      monthlySpending,
      monthsObserved: history.household.length,
    });
    if (months === null) {
      return null;
    }
    return {
      type: InsightType.IDLE_CASH,
      category: InsightCategory.PATTERN,
      severity: InsightSeverity.INFO,
      messageKey: 'pattern.idle_cash',
      messageParams: {
        cashAmount: Math.round(cash),
        reserveAmount: Math.round(monthlySpending * IDLE_CASH_MONTHS),
        months,
        currency,
      },
      deduplicationKey: `financial:idle_cash:${workspaceId}`,
      data: {
        priority: 32,
        cash: round2(cash),
        monthlySpending: round2(monthlySpending),
        months,
        threshold: IDLE_CASH_MONTHS,
      },
      expiresAt: endOfMonth(now),
    };
  }

  /**
   * Net worth passing a round number in the last `MILESTONE_WINDOW_DAYS`.
   * The peak before the window decides whether it is a first crossing; it is
   * only looked up when the all-time high is recent, which is the only time a
   * crossing can be.
   */
  private async milestoneAdvice(
    workspaceId: string,
    monthlySpending: number,
  ): Promise<InsightCandidate | null> {
    const netWorth = await this.netWorthService.getNetWorth(workspaceId, { range: '30d' });
    const windowStart = shiftDays(isoDate(new Date()), -(MILESTONE_WINDOW_DAYS - 1));
    const high = netWorth.allTimeHigh;
    if (!high || high.date < windowStart) {
      return null;
    }
    const before = await this.netWorthService.getNetWorth(workspaceId, {
      range: '30d',
      to: shiftDays(windowStart, -1),
    });
    const crossed = crossedMilestone({
      recent: netWorth.series.filter(point => point.date >= windowStart),
      peakBefore: before.allTimeHigh?.value ?? 0,
      floor: monthlySpending,
    });
    if (!crossed) {
      return null;
    }
    const [year, month, day] = crossed.date.split('-').map(Number);
    return {
      type: InsightType.NET_WORTH_MILESTONE,
      category: InsightCategory.PATTERN,
      severity: InsightSeverity.INFO,
      messageKey: 'pattern.net_worth_milestone',
      messageParams: {
        milestoneAmount: crossed.milestone,
        date: crossed.date,
        currency: netWorth.currency,
      },
      // One card per round number: a later, higher one is a new card.
      deduplicationKey: `financial:net_worth_milestone:${workspaceId}:${crossed.milestone}`,
      data: {
        priority: 26,
        milestone: crossed.milestone,
        date: crossed.date,
        current: netWorth.current,
      },
      expiresAt: new Date(year, month - 1, day + MILESTONE_WINDOW_DAYS),
    };
  }

  /** One card per unusual category, so each is announced once a month. */
  private anomalyAdvice(
    workspaceId: string,
    currency: string,
    anomaly: CategoryAnomaly,
    now: Date,
  ): InsightCandidate {
    const month = monthKey(now);
    return {
      type: InsightType.CATEGORY_ANOMALY,
      category: InsightCategory.TREND,
      severity: InsightSeverity.WARN,
      messageKey: 'trend.category_anomaly',
      messageParams: {
        category: anomaly.categoryName,
        currentAmount: Math.round(anomaly.current),
        usualAmount: Math.round(anomaly.usual),
        months: anomaly.months,
        currency,
      },
      deduplicationKey: `financial:category_anomaly:${workspaceId}:${anomaly.categoryId}:${month}`,
      data: {
        priority: 60,
        // The month judged, so the leaderboard the card opens shows the same total.
        month,
        categoryId: anomaly.categoryId,
        categoryName: anomaly.categoryName,
        current: round2(anomaly.current),
        usual: round2(anomaly.usual),
        ratio: round2(anomaly.ratio),
      },
      actions: [{ type: 'VIEW_REPORT', payload: { workspaceId, categoryId: anomaly.categoryId } }],
      expiresAt: endOfMonth(now),
    };
  }
}
