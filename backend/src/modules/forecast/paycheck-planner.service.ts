import { Injectable, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { currencyCodeOrDefault } from '../../common/utils/currency.util';
import {
  type PaycheckPlanQuery,
  type PaycheckPlanResponse,
  type PaycheckRate,
  type PayPeriodContext,
  periodBounds,
  periodOf,
  shiftMonth,
} from '../../contracts';
import { Transaction } from '../../entities/transaction.entity';
import { DashboardService } from '../dashboard/dashboard.service';
import { ExchangeRatesService } from '../exchange-rates/exchange-rates.service';
import { PayPeriodService } from '../pay-period/pay-period.service';
import { orCalendar } from '../pay-period/pay-period-dates';
import { TaxReserveService } from '../tax/tax-reserve.service';
import { addDays, detectRecurringIncome, formatDateOnly } from './forecast.engine';
import { ForecastService } from './forecast.service';
import { toPlanCommitments } from './paycheck-commitments';
import {
  readCommitmentCurrencies,
  readIncomeRows,
  readSpendingAccounts,
  readSubscriptionPayments,
} from './paycheck-data';
import {
  type PeriodBounds,
  type PlanCommitment,
  periodsFromPaydays,
  planPeriods,
} from './paycheck-planner';
import { assembleStreams, chooseStreams } from './paycheck-streams';

/** The current period and the next three. */
const PERIOD_COUNT = 4;
/** Paydays and commitments are read a year ahead: four monthly periods fit with room. */
const PROJECTION_DAYS = 365;
const INCOME_LOOKBACK_MONTHS = 12;

/**
 * `GET /forecast/paychecks`: payday to payday. Paydays come from the payers
 * the history repeats and the receivables the workspace declared; bills and
 * subscriptions from the dashboard's commitments (one definition of what is
 * owed), goal contributions from the forecast, the tax reserve as the
 * forecast's safe-to-spend takes it. Everything is in the workspace currency
 * at today's rates, and the answer names each rate it used.
 */
@Injectable()
export class PaycheckPlannerService {
  constructor(
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    private readonly dashboardService: DashboardService,
    private readonly forecastService: ForecastService,
    private readonly exchangeRatesService: ExchangeRatesService,
    @Optional()
    private readonly payPeriods?: PayPeriodService,
    @Optional()
    private readonly taxReserveService?: TaxReserveService,
  ) {}

  async plan(
    workspaceId: string,
    query: PaycheckPlanQuery,
    viewerMemberId: string | null,
  ): Promise<PaycheckPlanResponse> {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const today = formatDateOnly(now);
    const horizonEnd = addDays(today, PROJECTION_DAYS - 1);
    const since = formatDateOnly(
      new Date(now.getFullYear(), now.getMonth() - INCOME_LOOKBACK_MONTHS, 1),
    );
    const currency = await this.dashboardService.getWorkspaceCurrency(workspaceId);
    const quotes = new Map<string, Promise<PaycheckRate>>();
    const rateOf = (code: string | null | undefined): Promise<PaycheckRate> => {
      const from = currencyCodeOrDefault(code, currency);
      const cached = quotes.get(from);
      if (cached) return cached;
      const quote = this.exchangeRatesService
        .getRateQuote(from, currency, now, { workspaceId })
        .then(found => ({
          currency: from,
          rate: found?.rate ?? null,
          rateDate: found?.rateDate ?? null,
        }));
      quotes.set(from, quote);
      return quote;
    };
    // As the dashboard converts: no known rate counts 1:1 (and the answer says so).
    const convert = async (amount: number, code: string | null | undefined) =>
      amount * ((await rateOf(code)).rate ?? 1);

    const [commitments, receivables, goals, incomeRows, accounts, context] = await Promise.all([
      this.dashboardService.getCommitments(workspaceId, PROJECTION_DAYS),
      this.forecastService.receivableEvents(workspaceId, currency, today, horizonEnd),
      this.forecastService.goalEvents(workspaceId, currency, today, horizonEnd),
      readIncomeRows(this.transactionRepository, workspaceId, viewerMemberId, since),
      readSpendingAccounts(this.transactionRepository, workspaceId),
      this.payPeriods ? this.payPeriods.contextFor(workspaceId, now) : null,
    ]);

    const incomes = await Promise.all(
      incomeRows.map(async row => ({
        counterpartyName: row.counterpartyName,
        transactionDate: row.transactionDate,
        amount: await convert(Number.parseFloat(row.amount) || 0, row.currency),
      })),
    );
    const detected = detectRecurringIncome(incomes, today).map(income => {
      const payer = income.label.toLowerCase();
      const paydays = incomes
        .filter(row => (row.counterpartyName ?? '').trim().toLowerCase() === payer)
        .map(row => row.transactionDate);
      return { income, paydays };
    });
    const { streams, extras } = assembleStreams(detected, receivables, today, horizonEnd);
    const selected = chooseStreams(streams, query.streams);
    const chosen = streams.filter(item => selected.has(item.stream.id));
    const lastPayday =
      chosen
        .map(item => item.lastDate)
        .filter((date): date is string => date !== null)
        .sort()
        .pop() ?? null;
    const fromPaydays = periodsFromPaydays(
      today,
      lastPayday,
      chosen.flatMap(item => item.paydays.map(payday => payday.date)),
      PERIOD_COUNT,
    );
    const periods = fromPaydays.length > 0 ? fromPaydays : monthPeriods(context, today);

    const asked = query.walletIds ? new Set(query.walletIds) : null;
    const picked = asked ? accounts.filter(account => asked.has(account.id)) : [];
    let cash = commitments.openingBalance;
    if (picked.length > 0) {
      cash = 0;
      for (const account of picked) {
        cash += await convert(Number.parseFloat(account.balance) || 0, account.currency);
      }
    }

    const subscriptionIds = [
      ...new Set(
        commitments.items.filter(item => item.source === 'subscription').map(item => item.sourceId),
      ),
    ];
    const [payments, otherCurrencies] = await Promise.all([
      readSubscriptionPayments(this.transactionRepository, workspaceId, subscriptionIds),
      readCommitmentCurrencies(this.transactionRepository, workspaceId, today, picked.length === 0),
    ]);
    const owed: PlanCommitment[] = [
      ...toPlanCommitments(commitments.items, payments, today),
      ...goals.map(goal => ({
        date: goal.date,
        label: goal.label,
        amount: -goal.amount,
        kind: 'goal' as const,
        sourceId: goal.sourceId,
        isOverdue: false,
      })),
    ];
    const taxReserve = await this.taxReserve(workspaceId, now, currency);
    if (taxReserve > 0) {
      owed.push({
        date: today,
        label: 'tax',
        amount: taxReserve,
        kind: 'tax',
        sourceId: 'tax-reserve',
        isOverdue: false,
      });
    }

    const buffer = query.buffer ?? 0;
    const usedCurrencies = new Set([
      ...(picked.length > 0 ? picked : accounts).map(account => account.currency),
      ...incomeRows.map(row => row.currency),
      ...otherCurrencies,
    ]);
    const rates = (
      await Promise.all(
        [...usedCurrencies]
          .map(code => currencyCodeOrDefault(code, currency))
          .filter((code, index, all) => code !== currency && all.indexOf(code) === index)
          .map(rateOf),
      )
    ).sort((a, b) => a.currency.localeCompare(b.currency));

    return {
      currency,
      today,
      basis: fromPaydays.length > 0 ? 'paydays' : 'month',
      incomeStatus: detected.length > 0 ? 'regular' : incomeRows.length > 0 ? 'irregular' : 'none',
      buffer,
      streams: streams.map(item => ({ ...item.stream, selected: selected.has(item.stream.id) })),
      accounts: accounts.map(account => ({
        id: account.id,
        name: account.name,
        currency: account.currency,
        balance: Number.parseFloat(account.balance) || 0,
        selected: picked.length > 0 ? picked.includes(account) : true,
      })),
      rates,
      periods: planPeriods({
        today,
        cash,
        buffer,
        periods,
        paydays: [...streams.flatMap(item => item.paydays), ...extras],
        commitments: owed,
      }),
    };
  }

  /** What the forecast takes out of safe-to-spend for tax: the reserve in the workspace currency. */
  private async taxReserve(workspaceId: string, now: Date, currency: string): Promise<number> {
    if (!this.taxReserveService) return 0;
    const reserve = await this.taxReserveService.getReserve(workspaceId, now);
    return reserve.currency === currency ? reserve.total : 0;
  }
}

/** Without a payday ahead, the workspace's own months: the current one and the next three. */
function monthPeriods(context: PayPeriodContext | null, today: string): PeriodBounds[] {
  const rule = orCalendar(context);
  const current = periodOf(rule, today);
  return Array.from({ length: PERIOD_COUNT }, (_, index) => {
    const bounds = periodBounds(rule, shiftMonth(current, index));
    return { start: bounds.from, end: bounds.to, nextPayday: null };
  });
}
