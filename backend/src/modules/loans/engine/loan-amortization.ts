import { roundHalfAwayFromZero } from '../../../common/utils/money.util';
import { actualDays, days360 } from './loan-calendar';

export type LoanMethod = 'annuity' | 'linear' | 'interest_only';
export type DayCount = '30/360' | 'actual/365';
export type ExtraMode = 'reduce_term' | 'reduce_payment';

/** An annual rate in percent, in force from `from` on (inclusive). */
export interface RatePoint {
  from: string;
  annualRate: number;
}

/** Money below is in minor units (cents): whole numbers, so nothing drifts. */
export interface MinorExtra {
  date: string;
  amount: number;
}

export interface MinorRecurring {
  from: string;
  amount: number;
}

/** One run of the schedule: from a balance on a day, over the payment dates left. */
export interface AmortizationRun {
  balance: number;
  /** Interest accrues from this day; every date in `dates` is after it. */
  from: string;
  dates: readonly string[];
  /** The first period is a whole month (it starts on a payment day). */
  firstIsRegular: boolean;
  method: LoanMethod;
  dayCount: DayCount;
  /** Sorted by `from`; the first point holds from the start. */
  rates: readonly RatePoint[];
  extras: readonly MinorExtra[];
  recurring: readonly MinorRecurring[];
  mode: ExtraMode;
  /**
   * A regular amount to keep (annuity payment, linear principal) when it is
   * larger than the one the balance needs: the term then ends earlier.
   */
  keep?: number;
}

export interface MinorRow {
  date: string;
  annualRate: number;
  payment: number;
  interest: number;
  principal: number;
  extra: number;
  balance: number;
}

export function rateAt(rates: readonly RatePoint[], date: string): number {
  let rate = rates[0]?.annualRate ?? 0;
  for (const point of rates) {
    if (point.from <= date) {
      rate = point.annualRate;
    }
  }
  return rate;
}

/** The level payment that repays `balance` over `periods` months at `annualRate` percent. */
export function annuityPayment(balance: number, annualRate: number, periods: number): number {
  if (periods <= 0) {
    return balance;
  }
  const monthly = annualRate / 1200;
  if (monthly === 0) {
    return roundHalfAwayFromZero(balance / periods);
  }
  return roundHalfAwayFromZero((balance * monthly) / (1 - (1 + monthly) ** -periods));
}

/** Months a payment needs to repay a balance; Infinity when it does not cover the interest. */
export function periodsToRepay(balance: number, payment: number, annualRate: number): number {
  const monthly = annualRate / 1200;
  if (payment <= 0) {
    return Number.POSITIVE_INFINITY;
  }
  if (monthly === 0) {
    return Math.ceil(balance / payment - 1e-9);
  }
  if (payment <= balance * monthly) {
    return Number.POSITIVE_INFINITY;
  }
  return Math.ceil(-Math.log(1 - (balance * monthly) / payment) / Math.log(1 + monthly) - 1e-9);
}

/** The regular amount of a method: annuity payment, linear principal, nothing for interest-only. */
function regularAmount(
  method: LoanMethod,
  balance: number,
  annualRate: number,
  periods: number,
): number {
  if (method === 'annuity') {
    return annuityPayment(balance, annualRate, periods);
  }
  if (method === 'linear') {
    return roundHalfAwayFromZero(balance / Math.max(periods, 1));
  }
  return 0;
}

/** Days and rate changes split a period; each piece accrues at its own rate. */
function periodInterest(
  run: AmortizationRun,
  start: string,
  end: string,
  regular: boolean,
  balanceAt: (day: string) => number,
): { interest: number; lastRate: number } {
  const inside = (day: string) => day > start && day < end;
  const points = [
    ...new Set([
      start,
      ...run.rates.map(point => point.from).filter(inside),
      ...run.extras.map(extra => extra.date).filter(inside),
      end,
    ]),
  ].sort();
  let interest = 0;
  let used = 0;
  let lastRate = rateAt(run.rates, start);
  for (let index = 0; index < points.length - 1; index += 1) {
    const [from, to] = [points[index], points[index + 1]];
    let fraction: number;
    if (run.dayCount === 'actual/365') {
      fraction = actualDays(from, to) / 365;
    } else if (regular && index === points.length - 2) {
      // A whole month is 1/12 under 30/360, whatever the calendar says.
      fraction = Math.max(0, 1 / 12 - used);
    } else {
      fraction = days360(from, to) / 360;
      used += fraction;
    }
    lastRate = rateAt(run.rates, from);
    interest += (balanceAt(from) * lastRate * fraction) / 100;
  }
  return { interest: roundHalfAwayFromZero(interest), lastRate };
}

/**
 * The schedule of one run, period by period. Each period's interest is rounded
 * to the cent, and the last payment takes whatever balance is left, so the
 * principal parts always add up to the balance exactly.
 */
export function amortize(run: AmortizationRun): MinorRow[] {
  const rows: MinorRow[] = [];
  const last = run.dates.length - 1;
  const extras = run.extras.filter(extra => extra.date > run.from && extra.amount > 0);
  let balance = run.balance;
  let amount = 0;
  let paymentRate = Number.NaN;
  let shortened = false;
  // The period that takes the residue: the term's end, or an earlier one when a
  // rate change works the payment out over a term extra payments already cut.
  let final = last;

  for (let index = 0; index <= last && balance > 0; index += 1) {
    const start = index === 0 ? run.from : run.dates[index - 1];
    const end = run.dates[index];
    const remaining = run.dates.length - index;
    const rate = rateAt(run.rates, start);
    if (index === 0) {
      amount = regularAmount(run.method, balance, rate, remaining);
      if (run.keep !== undefined && run.keep > amount) {
        amount = run.keep;
        shortened = true;
      }
      paymentRate = rate;
    } else if (run.method === 'annuity' && rate !== paymentRate) {
      // A new rate: the payment is worked out again on what is left, over the
      // term that is left (shorter, when extra payments already cut it).
      const term = shortened
        ? Math.min(final - index + 1, periodsToRepay(balance, amount, paymentRate))
        : remaining;
      amount = annuityPayment(balance, rate, term);
      final = index + term - 1;
      paymentRate = rate;
    }

    // Extra payments inside the period lower the balance from their day on.
    let midExtra = 0;
    const { interest, lastRate } = periodInterest(
      run,
      start,
      end,
      index > 0 || run.firstIsRegular,
      day => {
        if (day !== start) {
          for (const extra of extras.filter(item => item.date === day)) {
            const paid = Math.min(extra.amount, balance);
            balance -= paid;
            midExtra += paid;
          }
        }
        return balance;
      },
    );

    let principal: number;
    if (index === final) {
      principal = balance;
    } else if (run.method === 'annuity') {
      principal = Math.max(0, amount - interest);
    } else {
      principal = amount;
    }
    principal = Math.min(principal, balance);
    balance -= principal;

    const due =
      extras.filter(extra => extra.date === end).reduce((sum, extra) => sum + extra.amount, 0) +
      run.recurring
        .filter(item => item.from <= end && item.amount > 0)
        .reduce((sum, item) => sum + item.amount, 0);
    const endExtra = Math.min(due, balance);
    balance -= endExtra;
    const extra = midExtra + endExtra;

    rows.push({
      date: end,
      annualRate: lastRate,
      payment: interest + principal,
      interest,
      principal,
      extra,
      balance,
    });

    if (extra > 0 && balance > 0) {
      if (run.mode === 'reduce_payment') {
        const nextRate = rateAt(run.rates, end);
        amount = regularAmount(run.method, balance, nextRate, last - index);
        paymentRate = nextRate;
      } else {
        shortened = true;
      }
    }
  }
  return rows;
}
