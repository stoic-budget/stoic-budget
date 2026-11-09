import { Injectable, Optional } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { onlyFlows } from '../../common/utils/counted-transactions.util';
import { MONTH_START_KEY } from '../../common/utils/workspace-settings-patch.util';
import {
  type DetectedSalary,
  type PayPeriodContext,
  type PayPeriodsResponse,
  periodBounds,
  periodOf,
  readMonthStart,
  shiftMonth,
} from '../../contracts';
import { Transaction, TransactionType } from '../../entities/transaction.entity';
import { Workspace } from '../../entities/workspace.entity';
import { detectRecurringIncome } from '../forecast/forecast.engine';
import { PublicHolidaysService } from '../reference-data/public-holidays.service';
import { dayKey } from './pay-period-dates';

/** Months of income the salary is looked for in: enough for three to six paydays. */
const SALARY_LOOKBACK_MONTHS = 6;

/** A resolved rule is reused this long; a settings change drops it at once. */
const CACHE_MS = 60_000;

export type ResolvedPayPeriod = PayPeriodContext & { holidayCountry: string | null };

/**
 * Resolves a workspace's month rule into what `periodBounds` needs: the
 * setting, the detected salary for `salary`, and the tax country's public
 * holidays for `last_business_day`. Every sum that is "this month" asks here
 * for the rule, so they all agree on the range.
 */
@Injectable()
export class PayPeriodService {
  private readonly cache = new Map<string, { at: number; value: Promise<ResolvedPayPeriod> }>();

  constructor(
    @InjectRepository(Workspace)
    private readonly workspaceRepository: Repository<Workspace>,
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    @Optional()
    private readonly publicHolidaysService?: PublicHolidaysService,
  ) {}

  /** The workspace's rule, ready for `periodBounds`; day 1 for a workspace that set none. */
  contextFor(workspaceId: string, today = new Date()): Promise<ResolvedPayPeriod> {
    const cached = this.cache.get(workspaceId);
    if (cached && Date.now() - cached.at < CACHE_MS) {
      return cached.value;
    }
    const value = this.resolve(workspaceId, today);
    value.catch(() => this.cache.delete(workspaceId));
    this.cache.set(workspaceId, { at: Date.now(), value });
    return value;
  }

  @OnEvent('workspace.updated')
  forget(event: { workspaceId: string }): void {
    this.cache.delete(event.workspaceId);
  }

  /**
   * `GET /pay-periods`: the rule with its inputs, and the current and next
   * period. The salary and the holidays are answered whatever the rule, so
   * the settings page can preview every choice before it is saved.
   */
  async describe(workspaceId: string, today = new Date()): Promise<PayPeriodsResponse> {
    const context = await this.contextFor(workspaceId, today);
    const month = periodOf(context, dayKey(today));
    const next = shiftMonth(month, 1);
    const salary = context.salary ?? (await this.detectSalary(workspaceId, today));
    const holidays = context.holidays?.length
      ? [...context.holidays]
      : await this.loadHolidays(context.holidayCountry, today);
    return {
      monthStart: context.monthStart,
      salary: salary ? { ...salary, paydays: [...salary.paydays] } : null,
      holidays,
      holidayCountry: context.holidayCountry,
      current: { month, ...periodBounds(context, month) },
      next: { month: next, ...periodBounds(context, next) },
    };
  }

  private async resolve(workspaceId: string, today: Date): Promise<ResolvedPayPeriod> {
    const workspace = await this.workspaceRepository.findOne({
      where: { id: workspaceId },
      relations: { taxJurisdiction: true },
    });
    const monthStart = readMonthStart(workspace?.settings?.[MONTH_START_KEY]);
    const holidayCountry = workspace?.taxJurisdiction?.code ?? null;
    const resolved: ResolvedPayPeriod = { monthStart, salary: null, holidays: [], holidayCountry };
    if (monthStart.kind === 'salary') {
      resolved.salary = await this.detectSalary(workspaceId, today);
    }
    if (monthStart.kind === 'last_business_day') {
      resolved.holidays = await this.loadHolidays(holidayCountry, today);
    }
    return resolved;
  }

  /** The country's public holidays (`YYYY-MM-DD`) from two years back to next year. */
  private async loadHolidays(country: string | null, today: Date): Promise<string[]> {
    if (!(country && this.publicHolidaysService)) {
      return [];
    }
    const year = today.getFullYear();
    const years = [year - 2, year - 1, year, year + 1];
    return [...(await this.publicHolidaysService.holidaysFor(country, years))].sort();
  }

  /**
   * The workspace's monthly salary: of the regular monthly payers the
   * forecast finds, the one paying the most. Private rows are left out, so
   * the period bounds are the same for every member and say nothing about a
   * row someone keeps to themselves.
   */
  private async detectSalary(workspaceId: string, today: Date): Promise<DetectedSalary | null> {
    const since = new Date(today.getFullYear(), today.getMonth() - SALARY_LOOKBACK_MONTHS, 1);
    const query = this.transactionRepository
      .createQueryBuilder('t')
      .select('t.counterparty_name', 'counterpartyName')
      .addSelect('t.credit', 'amount')
      .addSelect("TO_CHAR(t.transaction_date, 'YYYY-MM-DD')", 'transactionDate')
      .where('t.workspace_id = :workspaceId', { workspaceId });
    const rows = await onlyFlows(query, 't')
      .andWhere('t.transaction_type = :income', { income: TransactionType.INCOME })
      .andWhere('t.is_duplicate = false')
      .andWhere('t.is_private = false')
      .andWhere('t.transfer_pair_id IS NULL')
      .andWhere('t.transaction_date >= :since', { since: dayKey(since) })
      .getRawMany<{ counterpartyName: string | null; amount: string; transactionDate: string }>();
    const incomes = rows.map(row => ({ ...row, amount: Number.parseFloat(row.amount) || 0 }));
    const salary = detectRecurringIncome(incomes, dayKey(today))
      .filter(income => income.dayOfMonth !== null)
      .sort((a, b) => b.amount - a.amount)[0];
    if (!salary) {
      return null;
    }
    const payer = salary.label.toLowerCase();
    const paydays = incomes
      .filter(row => (row.counterpartyName ?? '').trim().toLowerCase() === payer)
      .map(row => row.transactionDate)
      .sort();
    return { dayOfMonth: medianDay(paydays), paydays };
  }
}

/** The usual day of the month of a set of paydays; one booked early or late moves it little. */
function medianDay(paydays: string[]): number {
  const days = paydays.map(day => Number(day.slice(8, 10))).sort((a, b) => a - b);
  const middle = Math.floor(days.length / 2);
  return days.length % 2 ? days[middle] : Math.round((days[middle - 1] + days[middle]) / 2);
}
