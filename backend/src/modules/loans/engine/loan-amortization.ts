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

/**
 * Money below is in minor units (cents): whole numbers, so nothing drifts. Each
 * extra payment carries what it buys, so a what-if tried in one mode on top of
 * a plan saved in the other leaves the saved ones as they were.
 */
export interface MinorExtra {
  date: string;
  amount: number;
  mode: ExtraMode;
}

export interface MinorRecurring {
  from: string;
  amount: number;
  mode: ExtraMode;
}

/** One run of the schedule: from a balance on a day, over the payment dates left. */
export interface AmortizationRun {
  balance: number;
  /** Interest accrues from this day; every date in `dates` is after it. Extras on it are paid first. */
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

/**
 * The level payment that repays `balance` over `periods` payments at
 * `annualRate` percent. The first period runs `firstYears` of a year (a
 * twelfth: a whole month) and every later one a whole month. A shorter or
 * longer first period changes only the first interest, so the payment is
 * solved with it: what is owed on the first payment date, against the first
 * payment and the rest discounted to that date. Every regular payment is then
 * the same and the last one ends the term. Without interest the cents are
 * rounded down, so the payments never run out before the term; the last takes
 * the remainder.
 */
export function annuityPayment(
  balance: number,
  annualRate: number,
  periods: number,
  firstYears = 1 / 12,
): number {
  if (periods <= 0) {
    return balance;
  }
  const monthly = annualRate / 1200;
  if (monthly === 0) {
    return Math.floor(balance / periods);
  }
  const later = (1 - (1 + monthly) ** -(periods - 1)) / monthly;
  return roundHalfAwayFromZero((balance * (1 + (annualRate / 100) * firstYears)) / (1 + later));
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

/**
 * The regular amount of a method: annuity payment, linear principal, nothing
 * for interest-only. The linear part is rounded down, so it never repays the
 * balance before the term; the last payment takes the cents left over.
 */
export function regularAmount(
  method: LoanMethod,
  balance: number,
  annualRate: number,
  periods: number,
  firstYears = 1 / 12,
): number {
  if (method === 'annuity') {
    return annuityPayment(balance, annualRate, periods, firstYears);
  }
  if (method === 'linear') {
    return Math.floor(balance / Math.max(periods, 1));
  }
  return 0;
}

/**
 * Periods a regular amount still needs for a balance, with the part of a
 * period the last payment covers; Infinity when it never repays it.
 */
function periodsLeft(method: LoanMethod, balance: number, amount: number, annualRate: number) {
  const monthly = annualRate / 1200;
  if (amount <= 0 || method === 'interest_only') {
    return Number.POSITIVE_INFINITY;
  }
  if (method === 'linear' || monthly === 0) {
    return balance / amount;
  }
  return amount <= balance * monthly
    ? Number.POSITIVE_INFINITY
    : -Math.log(1 - (balance * monthly) / amount) / Math.log(1 + monthly);
}

/** The first period as a part of a year: a twelfth when it is a whole month, else its own days. */
export function firstPeriodYears(
  run: Pick<AmortizationRun, 'from' | 'dates' | 'firstIsRegular' | 'dayCount'>,
): number {
  const end = run.dates[0];
  if (run.firstIsRegular || end === undefined) {
    return 1 / 12;
  }
  return run.dayCount === 'actual/365'
    ? actualDays(run.from, end) / 365
    : days360(run.from, end) / 360;
}

/** What extra payments took from the balance, by what they buy. */
type Paid = Record<ExtraMode, number>;

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
  const extras = run.extras.filter(extra => extra.date >= run.from && extra.amount > 0);
  let balance = run.balance;
  let amount = 0;
  let paymentRate = Number.NaN;
  let shortened = false;
  // The period that takes the residue: the term's end, or an earlier one when a
  // rate change works the payment out over a term extra payments already cut.
  let final = last;

  /** Pays each item in turn from the balance, never more than is owed. */
  const pay = (items: ReadonlyArray<{ amount: number; mode: ExtraMode }>, paid: Paid) => {
    for (const item of items) {
      const part = Math.min(item.amount, balance);
      balance -= part;
      paid[item.mode] += part;
    }
    return paid;
  };

  /**
   * After extra payments, before period `next`: those that shorten the term
   * keep the amount; those that lower the payment work it out again on what
   * is left, over the term left. When the term was already cut (by the first
   * kind, now or before), that is the cut term, to the part of a period, so a
   * small extra lowers the payment a little instead of spreading a short last
   * payment over the whole of its month.
   */
  const rebalance = (paid: Paid, next: number, annualRate: number, firstYears: number) => {
    if (balance <= 0) {
      return;
    }
    if (paid.reduce_term > 0) {
      shortened = true;
    }
    if (paid.reduce_payment > 0) {
      const left = run.dates.length - next;
      const term = shortened
        ? Math.max(
            1,
            Math.min(
              left,
              periodsLeft(run.method, balance + paid.reduce_payment, amount, paymentRate),
            ),
          )
        : left;
      amount = regularAmount(run.method, balance, annualRate, term, firstYears);
      paymentRate = annualRate;
      final = next + Math.ceil(term - 1e-9) - 1;
    }
  };

  for (let index = 0; index <= last && balance > 0; index += 1) {
    const start = index === 0 ? run.from : run.dates[index - 1];
    const end = run.dates[index];
    const remaining = run.dates.length - index;
    const rate = rateAt(run.rates, start);
    let startExtra = 0;
    if (index === 0) {
      const firstYears = firstPeriodYears(run);
      amount = regularAmount(run.method, balance, rate, remaining, firstYears);
      if (run.keep !== undefined && run.keep > amount) {
        amount = run.keep;
        shortened = true;
      }
      paymentRate = rate;
      // Paid on the start day: the balance is lower before any interest runs.
      const opening = pay(
        extras.filter(extra => extra.date === start),
        { reduce_term: 0, reduce_payment: 0 },
      );
      rebalance(opening, 0, rate, firstYears);
      startExtra = opening.reduce_term + opening.reduce_payment;
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
    const paid: Paid = { reduce_term: 0, reduce_payment: 0 };
    const { interest, lastRate } = periodInterest(
      run,
      start,
      end,
      index > 0 || run.firstIsRegular,
      day => {
        if (day !== start) {
          pay(
            extras.filter(item => item.date === day),
            paid,
          );
        }
        return balance;
      },
    );

    let principal: number;
    if (index === final) {
      principal = balance;
    } else if (run.method === 'annuity') {
      // The first payment is solved with the first period's own days: when a
      // long first period owes more interest than the payment, the rest is
      // added to the balance, and the payment stays the same as the others.
      principal = index === 0 ? amount - interest : Math.max(0, amount - interest);
    } else {
      principal = amount;
    }
    principal = Math.min(principal, balance);
    balance -= principal;

    pay(
      [
        ...extras.filter(extra => extra.date === end),
        ...run.recurring.filter(item => item.from <= end && item.amount > 0),
      ],
      paid,
    );

    rows.push({
      date: end,
      annualRate: lastRate,
      payment: interest + principal,
      interest,
      principal,
      extra: startExtra + paid.reduce_term + paid.reduce_payment,
      balance,
    });
    rebalance(paid, index + 1, rateAt(run.rates, end), 1 / 12);
  }
  return rows;
}
