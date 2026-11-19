import { roundHalfAwayFromZero } from '../../../common/utils/money.util';
import { actualDays, days360, paymentDateAfter } from './loan-calendar';

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
  /** 1–31: places the whole month a broken first period stands in for. */
  paymentDay: number;
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
 * The level payment that repays `balance` over periods of the given lengths
 * (parts of a year) at `annualRate` percent: the balance against every payment
 * discounted over the real length of each period, so the last payment takes
 * only the rounding of the cents. A twelfth for every period is the textbook
 * annuity. `lastWeight` is the part of a payment the last one is (a term cut
 * by extra payments ends with a part of one). Without interest the cents are
 * rounded down, so the payments never run out before the term.
 */
export function levelPayment(
  balance: number,
  annualRate: number,
  years: readonly number[],
  lastWeight = 1,
): number {
  if (years.length === 0) {
    return balance;
  }
  let discount = 1;
  let worth = 0;
  years.forEach((part, index) => {
    discount /= 1 + (annualRate * part) / 100;
    worth += discount * (index === years.length - 1 ? lastWeight : 1);
  });
  return annualRate === 0 ? Math.floor(balance / worth) : roundHalfAwayFromZero(balance / worth);
}

/** The textbook annuity: `periods` whole months of a twelfth of a year. */
export function annuityPayment(balance: number, annualRate: number, periods: number): number {
  return levelPayment(balance, annualRate, Array(Math.max(periods, 0)).fill(1 / 12));
}

/**
 * What one unit paid each period grows to by the end, carried with the
 * interest of the periods after it: how far a cent of rounding a period can
 * move the last payment.
 */
export function carriedFactor(annualRate: number, years: readonly number[]): number {
  return years.reduce((carried, part) => carried * (1 + (annualRate * part) / 100) + 1, 0);
}

/**
 * The regular amount of a method over the given periods: annuity payment,
 * linear principal, nothing for interest-only. The linear part is rounded
 * down, so it never repays the balance before the term; the last payment
 * takes the cents left over.
 */
export function regularAmount(
  method: LoanMethod,
  balance: number,
  annualRate: number,
  years: readonly number[],
  lastWeight = 1,
): number {
  if (method === 'annuity') {
    return levelPayment(balance, annualRate, years, lastWeight);
  }
  if (method === 'linear') {
    return Math.floor(balance / Math.max(years.length - 1 + lastWeight, 1));
  }
  return 0;
}

/**
 * Periods a regular amount still needs for a balance, with the part of a
 * period the last payment is; Infinity when the periods given are not enough.
 */
function periodsNeeded(
  method: LoanMethod,
  balance: number,
  amount: number,
  annualRate: number,
  years: readonly number[],
): number {
  if (amount <= 0 || method === 'interest_only') {
    return Number.POSITIVE_INFINITY;
  }
  if (method === 'linear') {
    return balance / amount;
  }
  let owed = balance;
  for (let index = 0; index < years.length; index += 1) {
    owed *= 1 + (annualRate * years[index]) / 100;
    if (owed <= amount) {
      return index + owed / amount;
    }
    owed -= amount;
  }
  return Number.POSITIVE_INFINITY;
}

/**
 * Each period as a part of a year, as its interest is charged: a twelfth
 * under 30/360, its days under actual/365. A broken first period counts as the
 * whole month before the first payment date: the regular payment is worked
 * out on whole periods, and the first payment adds (or gives back) the
 * interest of the days it runs longer (or shorter).
 */
export function periodYears(
  run: Pick<AmortizationRun, 'from' | 'dates' | 'firstIsRegular' | 'dayCount' | 'paymentDay'>,
): number[] {
  return run.dates.map((end, index) => {
    if (run.dayCount === '30/360') {
      return 1 / 12;
    }
    let start = index === 0 ? run.from : run.dates[index - 1];
    if (index === 0 && !run.firstIsRegular) {
      start = paymentDateAfter(end, -1, run.paymentDay);
    }
    return actualDays(start, end) / 365;
  });
}

/**
 * The payment a bank quotes at the start, at the rate in force then: the
 * annuity payment, or the linear part (or nothing) plus a whole period's interest.
 */
export function quotedPayment(run: AmortizationRun): number {
  const years = periodYears(run);
  const rate = rateAt(run.rates, run.from);
  const amount = regularAmount(run.method, run.balance, rate, years);
  if (run.method === 'annuity') {
    return amount;
  }
  return amount + roundHalfAwayFromZero((run.balance * rate * (years[0] ?? 1 / 12)) / 100);
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
 * principal parts always add up to the balance exactly. The first payment of
 * a broken first period repays what a whole one would, with its own interest.
 */
export function amortize(run: AmortizationRun): MinorRow[] {
  const rows: MinorRow[] = [];
  const last = run.dates.length - 1;
  const years = periodYears(run);
  const extras = run.extras.filter(extra => extra.date >= run.from && extra.amount > 0);
  let balance = run.balance;
  let amount = 0;
  let paymentRate = Number.NaN;
  let shortened = false;
  // The period that takes the residue: the term's end, or an earlier one when
  // the payment is worked out over a term extra payments already cut.
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
   * Works the amount out again on what is left from period `next` on: over
   * the rest of the term, or, once extra payments cut it, over the cut term
   * as the amount kept so far would repay `owed` (to the part of a period, so
   * a small extra lowers the payment a little).
   */
  const resolve = (next: number, annualRate: number, owed: number) => {
    const left = run.dates.length - next;
    const term = shortened
      ? Math.max(
          1,
          Math.min(left, periodsNeeded(run.method, owed, amount, paymentRate, years.slice(next))),
        )
      : left;
    const whole = Math.ceil(term - 1e-9);
    amount = regularAmount(
      run.method,
      balance,
      annualRate,
      years.slice(next, next + whole),
      term - whole + 1,
    );
    paymentRate = annualRate;
    final = next + whole - 1;
  };

  /** After extra payments: those that shorten the term keep the amount, the others lower it. */
  const rebalance = (paid: Paid, next: number, annualRate: number) => {
    if (balance <= 0) {
      return;
    }
    if (paid.reduce_term > 0) {
      shortened = true;
    }
    if (paid.reduce_payment > 0) {
      resolve(next, annualRate, balance + paid.reduce_payment);
    }
  };

  for (let index = 0; index <= last && balance > 0; index += 1) {
    const start = index === 0 ? run.from : run.dates[index - 1];
    const end = run.dates[index];
    const rate = rateAt(run.rates, start);
    let startExtra = 0;
    if (index === 0) {
      amount = regularAmount(run.method, balance, rate, years);
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
      rebalance(opening, 0, rate);
      startExtra = opening.reduce_term + opening.reduce_payment;
    } else if (run.method === 'annuity' && rate !== paymentRate) {
      // A new rate: the payment is worked out again on what is left.
      resolve(index, rate, balance);
    }
    // What a whole first period would charge: the principal a regular payment repays.
    const wholeInterest = roundHalfAwayFromZero((balance * rate * years[index]) / 100);

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
      // The payment stays level: under actual/365 a 31-day month at a high rate
      // can charge more than it, and the rest is added to the balance (clamping
      // it would leave the loan ahead of its schedule and end it early).
      principal = amount - (index === 0 && !run.firstIsRegular ? wholeInterest : interest);
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
    rebalance(paid, index + 1, rateAt(run.rates, end));
  }
  return rows;
}
