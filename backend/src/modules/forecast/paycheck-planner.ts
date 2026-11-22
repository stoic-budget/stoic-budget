/**
 * Payday to payday: the periods between paydays, what arrives and what is
 * due in each, and what is safe to spend. Pure, over amounts already in the
 * workspace currency.
 *
 * Safe to spend is read at the period's lowest point, so a bill due before
 * the money that would cover it arrives is not paid with that money:
 * cash + income − commitments − buffer when the income comes first, less
 * when it does not. Negative means the period is short by that much.
 *
 * Later periods start with a projected cash: what the period before ends
 * with if the person spends exactly what was safe to spend there (the buffer
 * plus anything that arrived too late to spend, or the shortfall carried on).
 */
import type { PaycheckItem, PaycheckItemKind, PaycheckPeriod } from '../../contracts';
import { addDays } from './forecast.engine';

export interface PlanPayday {
  date: string;
  amount: number;
  label: string;
  /** The stream it belongs to; null for a one-off receivable. */
  streamId: string | null;
  sourceId: string;
  isLate: boolean;
}

export interface PlanCommitment {
  date: string;
  label: string;
  /** Money out, positive. */
  amount: number;
  kind: Exclude<PaycheckItemKind, 'income'>;
  sourceId: string;
  isOverdue: boolean;
}

export interface PeriodBounds {
  start: string;
  end: string;
  nextPayday: string | null;
}

/** Paydays of the chosen streams this close together start one period, not two. */
const SAME_PAYDAY_DAYS = 3;

/**
 * The current period and the next ones from the paydays that start them.
 * The current one starts on the last payday before today (or today, when a
 * payday lands today or none came before); empty when no payday lies ahead.
 */
export function periodsFromPaydays(
  today: string,
  lastPayday: string | null,
  paydays: string[],
  count: number,
): PeriodBounds[] {
  const dates: string[] = [];
  for (const date of [...new Set(paydays)].filter(day => day >= today).sort()) {
    const previous = dates[dates.length - 1];
    if (previous && date <= addDays(previous, SAME_PAYDAY_DAYS)) continue;
    dates.push(date);
  }
  if (dates.length === 0) return [];
  let index = 0;
  let start = lastPayday && lastPayday < today ? lastPayday : today;
  if (dates[0] === today) {
    start = today;
    index = 1;
  }
  const periods: PeriodBounds[] = [];
  for (; periods.length < count && index < dates.length; index += 1) {
    periods.push({ start, end: addDays(dates[index], -1), nextPayday: dates[index] });
    start = dates[index];
  }
  return periods;
}

export function planPeriods(input: {
  today: string;
  cash: number;
  buffer: number;
  periods: PeriodBounds[];
  paydays: PlanPayday[];
  commitments: PlanCommitment[];
}): PaycheckPeriod[] {
  const result: PaycheckPeriod[] = [];
  let cash = input.cash;
  for (const [index, period] of input.periods.entries()) {
    const from = period.start > input.today ? period.start : input.today;
    const within = (date: string) => date >= from && date <= period.end;
    const items: PaycheckItem[] = [
      ...input.paydays.filter(payday => within(payday.date)).map(incomeItem),
      ...input.commitments.filter(item => within(item.date)).map(commitmentItem),
    ].sort(byDateIncomeFirst);

    // The balance at the end of each day with money moving; the cash before
    // the first day counts too, unless money arrives on that first day.
    let running = cash;
    let lowest = items[0]?.date === from ? Number.POSITIVE_INFINITY : cash;
    let income = 0;
    let commitments = 0;
    for (const [position, item] of items.entries()) {
      running += item.amount;
      if (item.amount > 0) income += item.amount;
      else commitments -= item.amount;
      if (items[position + 1]?.date !== item.date) lowest = Math.min(lowest, running);
    }
    if (items.length === 0) lowest = cash;
    const safeToSpend = round(lowest - input.buffer);
    const daysLeft = daysBetween(from, period.end) + 1;
    result.push({
      start: period.start,
      end: period.end,
      nextPayday: period.nextPayday,
      daysLeft,
      startingCash: round(cash),
      startingCashProjected: index > 0,
      income: round(income),
      commitments: round(commitments),
      safeToSpend,
      safeToSpendPerDay: safeToSpend > 0 ? round(safeToSpend / daysLeft) : 0,
      items,
    });
    cash = running - Math.max(0, safeToSpend);
  }
  return result;
}

function incomeItem(payday: PlanPayday): PaycheckItem {
  return {
    date: payday.date,
    label: payday.label,
    amount: round(payday.amount),
    kind: 'income',
    sourceId: payday.sourceId,
    isOverdue: payday.isLate,
    streamId: payday.streamId,
  };
}

function commitmentItem(item: PlanCommitment): PaycheckItem {
  return {
    date: item.date,
    label: item.label,
    amount: -round(item.amount),
    kind: item.kind,
    sourceId: item.sourceId,
    isOverdue: item.isOverdue,
    streamId: null,
  };
}

/** By day; on one day the money in comes first, so a bill due on payday is paid from it. */
function byDateIncomeFirst(a: PaycheckItem, b: PaycheckItem): number {
  return a.date.localeCompare(b.date) || b.amount - a.amount;
}

function daysBetween(from: string, to: string): number {
  const [fy, fm, fd] = from.split('-').map(Number);
  const [ty, tm, td] = to.split('-').map(Number);
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86_400_000);
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
