import { Between, type FindOperator, type Repository } from 'typeorm';
import type { PayPeriodContext, SubscriptionMonthStatus } from '../../contracts';
import type { SubscriptionCharge } from '../../entities/subscription-charge.entity';
import type { ExchangeRatesService } from '../exchange-rates/exchange-rates.service';
import {
  type DateRange,
  dayKey,
  periodKeyAt,
  periodRangeAt,
  periodRangeOfKey,
} from '../pay-period/pay-period-dates';
import { CurrencyTotals } from './currency-totals';

/**
 * A month here is the workspace's own (`settings.monthStart`): the calendar
 * month unless it starts on another day.
 */

/** Turns an amount into the workspace currency at the rate of a given day. */
export type ConvertAt = (amount: number, currency: string, day: Date) => Promise<number>;

/** The workspace currency (upper case, null when unset) and a converter into it. */
export interface WorkspaceMoney {
  currency: string | null;
  convert: ConvertAt;
}

export function workspaceMoney(
  rates: ExchangeRatesService,
  workspaceId: string,
  workspaceCurrency: string | null | undefined,
): WorkspaceMoney {
  const currency = workspaceCurrency?.toUpperCase() ?? null;
  const convert: ConvertAt = async (amount, from, day) =>
    currency ? (await rates.convert(amount, from, currency, day, workspaceId)).converted : amount;
  return { currency, convert };
}

const localDay = dayKey;

/** The days of a month as a `date` column filter, first to last. */
const monthDays = ({ start, end }: DateRange): FindOperator<Date> =>
  Between(localDay(start), localDay(end)) as unknown as FindOperator<Date>;

/** `month` (`YYYY-MM`) is over: it is before the month `today` is in. */
export function isPastMonth(
  month: string | undefined,
  today: Date,
  payPeriod?: PayPeriodContext | null,
): month is string {
  return month !== undefined && month < periodKeyAt(payPeriod, today);
}

/**
 * The month a status is for (`month`, or the one `today` is in) with its name,
 * its range, and the day that splits paid from still to pay: today, or the
 * month's first day when it is still ahead.
 */
export function monthInView(
  month: string | undefined,
  today: Date,
  payPeriod?: PayPeriodContext | null,
): { key: string; period: DateRange; today: Date } {
  const current = periodKeyAt(payPeriod, today);
  if (!month || month <= current) {
    return { key: current, period: periodRangeAt(payPeriod, today), today };
  }
  const period = periodRangeOfKey(payPeriod, month);
  return { key: month, period, today: period.start };
}

/** How many payments each subscription of the workspace has recorded in a month. */
export async function chargesInMonth(
  charges: Repository<SubscriptionCharge>,
  workspaceId: string,
  month: DateRange,
): Promise<Map<string, number>> {
  const rows = await charges.find({
    select: { subscriptionId: true },
    where: { workspaceId, chargeDate: monthDays(month) },
  });
  const counts = new Map<string, number>();
  for (const row of rows) {
    counts.set(row.subscriptionId, (counts.get(row.subscriptionId) ?? 0) + 1);
  }
  return counts;
}

/**
 * A month that is over, told by what was charged in it: the subscriptions that
 * charged then, cancelled ones included, at the amounts that went out. One that
 * did not exist yet, or charged nothing, is not in it; nothing is left to come.
 */
export async function pastMonthStatus(
  charges: Repository<SubscriptionCharge>,
  { currency, convert }: WorkspaceMoney,
  workspaceId: string,
  month: string,
  payPeriod?: PayPeriodContext | null,
): Promise<SubscriptionMonthStatus> {
  const rows = await charges.find({
    where: { workspaceId, chargeDate: monthDays(periodRangeOfKey(payPeriod, month)) },
    relations: { subscription: true },
    order: { chargeDate: 'ASC' },
  });

  const paidByCurrency = new CurrencyTotals();
  const bySubscription = new Map<string, SubscriptionMonthStatus['items'][number]>();
  let paidAmount = 0;
  for (const charge of rows) {
    // A `date` column comes back as `YYYY-MM-DD`; read as a local day, not UTC midnight.
    const dayText =
      charge.chargeDate instanceof Date
        ? localDay(charge.chargeDate)
        : String(charge.chargeDate).slice(0, 10);
    const day = new Date(`${dayText}T00:00:00`);
    const amount = Number(charge.amount);
    paidByCurrency.add(charge.currency, amount);
    const converted =
      currency && charge.currency.toUpperCase() !== currency
        ? await convert(amount, charge.currency, day)
        : amount;
    paidAmount += converted;
    const item = bySubscription.get(charge.subscriptionId);
    bySubscription.set(charge.subscriptionId, {
      subscriptionId: charge.subscriptionId,
      vendorName: charge.subscription.vendorName,
      vendorDomain: charge.subscription.vendorDomain ?? null,
      amount: Math.round(((item?.amount ?? 0) + converted) * 100) / 100,
      paid: true,
      nextChargeDate: dayText,
    });
  }

  return {
    currency,
    month,
    paidAmount: Math.round(paidAmount * 100) / 100,
    paidCount: rows.length,
    unpaidAmount: 0,
    unpaidCount: 0,
    paidByCurrency: paidByCurrency.list(),
    unpaidByCurrency: [],
    items: [...bySubscription.values()],
  };
}
