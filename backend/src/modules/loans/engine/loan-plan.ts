import { fromMinor, toMinor } from '../../../common/utils/money.util';
import {
  type AmortizationRun,
  amortize,
  carriedFactor,
  type DayCount,
  type ExtraMode,
  type LoanMethod,
  levelPayment,
  type MinorRow,
  periodYears,
  quotedPayment,
} from './loan-amortization';
import { firstPaymentMonth, isPaymentDay, paymentDateAfter } from './loan-calendar';

/**
 * A loan's terms in major units and percent, as stored. An extra payment
 * without its own mode buys what `extraMode` says.
 */
export interface LoanPlanInput {
  principal: number;
  startDate: string;
  termMonths: number;
  /** 1–31; a month without that day pays on its last day. */
  paymentDay: number;
  method: LoanMethod;
  dayCount: DayCount;
  annualRate: number;
  rateChanges: ReadonlyArray<{ from: string; annualRate: number }>;
  extraPayments: ReadonlyArray<{ date: string; amount: number; mode?: ExtraMode }>;
  recurringExtras: ReadonlyArray<{ from: string; amount: number; mode?: ExtraMode }>;
  extraMode: ExtraMode;
}

export interface ScheduleRow {
  period: number;
  date: string;
  annualRate: number;
  payment: number;
  interest: number;
  principal: number;
  extra: number;
  balance: number;
}

export interface ScheduleSummary {
  periods: number;
  payoffDate: string | null;
  totalInterest: number;
  totalPaid: number;
  /** A whole month's payment at the start: the figure a bank quotes. */
  regularPayment: number;
}

export interface Schedule extends ScheduleSummary {
  rows: ScheduleRow[];
}

export interface Projection extends Schedule {
  /** The day interest is counted from: the last payment date before today, or the start. */
  from: string;
  startBalance: number;
}

/**
 * The payment dates of the whole term, oldest first: the first is the first
 * payment day at least half a month after the start (see `firstPaymentMonth`).
 * Past the year 9999 a date no longer has four digits of year.
 */
export function paymentDates(
  input: Pick<LoanPlanInput, 'startDate' | 'termMonths' | 'paymentDay'>,
) {
  const first = firstPaymentMonth(input.startDate, input.paymentDay);
  return Array.from({ length: input.termMonths }, (_, index) =>
    paymentDateAfter(input.startDate, first + index, input.paymentDay),
  );
}

function runOf(
  input: LoanPlanInput,
  balance: number,
  from: string,
  dates: readonly string[],
  firstIsRegular: boolean,
): AmortizationRun {
  return {
    balance,
    from,
    dates,
    firstIsRegular,
    paymentDay: input.paymentDay,
    method: input.method,
    dayCount: input.dayCount,
    rates: [
      { from: '', annualRate: input.annualRate },
      ...[...input.rateChanges].sort((a, b) => a.from.localeCompare(b.from)),
    ],
    extras: input.extraPayments
      .map(extra => ({
        date: extra.date,
        amount: toMinor(extra.amount),
        mode: extra.mode ?? input.extraMode,
      }))
      .sort((a, b) => a.date.localeCompare(b.date)),
    recurring: input.recurringExtras.map(item => ({
      from: item.from,
      amount: toMinor(item.amount),
      mode: item.mode ?? input.extraMode,
    })),
  };
}

function toSchedule(rows: MinorRow[], regularPayment: number): Schedule {
  return {
    rows: rows.map((row, index) => ({
      period: index + 1,
      date: row.date,
      annualRate: row.annualRate,
      payment: fromMinor(row.payment),
      interest: fromMinor(row.interest),
      principal: fromMinor(row.principal),
      extra: fromMinor(row.extra),
      balance: fromMinor(row.balance),
    })),
    periods: rows.length,
    payoffDate: rows.length > 0 ? rows[rows.length - 1].date : null,
    totalInterest: fromMinor(rows.reduce((sum, row) => sum + row.interest, 0)),
    totalPaid: fromMinor(rows.reduce((sum, row) => sum + row.payment + row.extra, 0)),
    regularPayment: fromMinor(regularPayment),
  };
}

function planRun(input: LoanPlanInput): AmortizationRun {
  return runOf(
    input,
    toMinor(input.principal),
    input.startDate,
    paymentDates(input),
    isPaymentDay(input.startDate, input.paymentDay),
  );
}

/** The whole schedule the terms describe, from the start date. */
export function buildSchedule(input: LoanPlanInput): Schedule {
  const run = planRun(input);
  return toSchedule(amortize(run), quotedPayment(run));
}

/**
 * Whether rounding the payment to the cent keeps an annuity on its term: half
 * a cent a period, carried with interest to the end, must move the last
 * payment by less than a whole payment. A long term at a high rate on a small
 * principal fails it (1,000 at 30% over 600 months repays under a cent a
 * month: rounded, it is an interest-only loan). Checked at the highest rate
 * the terms name.
 */
export function roundsWithinTerm(input: LoanPlanInput): boolean {
  const rate = Math.max(input.annualRate, ...input.rateChanges.map(change => change.annualRate));
  if (input.method !== 'annuity' || rate === 0) {
    return true;
  }
  const run = planRun(input);
  const years = periodYears(run);
  return carriedFactor(rate, years) / 2 < levelPayment(run.balance, rate, years);
}

/**
 * What is left to pay from the real balance on `today`, over the payment dates
 * left in the term. Interest runs from the last payment date (the balance is
 * what was left after it). With `reduce_term` the planned payment is kept, so
 * being ahead ends the loan earlier; being behind raises the payment to still
 * finish on time. Null when nothing is owed or no payment date is left.
 */
export function projectSchedule(
  input: LoanPlanInput,
  today: string,
  outstanding: number,
): Projection | null {
  const dates = paymentDates(input);
  const past = dates.filter(date => date <= today).length;
  const remaining = dates.slice(past);
  const balance = toMinor(outstanding);
  if (remaining.length === 0 || balance <= 0) {
    return null;
  }
  const from = past > 0 ? dates[past - 1] : input.startDate;
  const firstIsRegular = past > 0 || isPaymentDay(input.startDate, input.paymentDay);
  const future = {
    ...input,
    extraPayments: input.extraPayments.filter(extra => extra.date > today),
  };
  const run = runOf(future, balance, from, remaining, firstIsRegular);

  if (input.extraMode === 'reduce_term' && input.method !== 'interest_only') {
    const planned = amortize(planRun(input));
    const next = planned[past];
    if (next && past < planned.length - 1) {
      // Before the first payment date the plan's regular payment, not its
      // first one (that carries the days of a broken first period).
      const payment = past === 0 ? quotedPayment(planRun(input)) : next.payment;
      run.keep = input.method === 'annuity' ? payment : next.principal;
    }
  }
  const rows = amortize(run);
  const regular = (firstIsRegular ? rows[0] : rows[1]) ?? rows[0];
  return {
    ...toSchedule(rows, regular?.payment ?? 0),
    from,
    startBalance: fromMinor(balance),
  };
}

export interface WhatIfResult {
  baseline: ScheduleSummary;
  scenario: ScheduleSummary;
  monthsSaved: number;
  interestSaved: number;
  /** After the what-if's first extra payment: the payment as planned and as it would be. */
  paymentBefore: number | null;
  paymentAfter: number | null;
}

const summaryOf = ({ rows: _rows, ...summary }: Schedule): ScheduleSummary => summary;

/**
 * The plan against the plan plus some extra payments made in `mode`. The
 * extra payments already in the plan keep buying what they were saved to buy.
 */
export function whatIf(
  input: LoanPlanInput,
  extra: Pick<LoanPlanInput, 'extraPayments' | 'recurringExtras' | 'extraMode'>,
): WhatIfResult {
  const mode = extra.extraMode;
  const tried = {
    extraPayments: extra.extraPayments.filter(item => item.date >= input.startDate),
    recurringExtras: extra.recurringExtras,
  };
  const baseline = buildSchedule(input);
  const scenario = buildSchedule({
    ...input,
    extraPayments: [
      ...input.extraPayments,
      ...tried.extraPayments.map(item => ({ ...item, mode })),
    ],
    recurringExtras: [
      ...input.recurringExtras,
      ...tried.recurringExtras.map(item => ({ ...item, mode })),
    ],
  });
  // The period of the what-if's first extra payment: the first one ending on or after it.
  const firstDay = [
    ...tried.extraPayments.map(item => item.date),
    ...tried.recurringExtras.map(item => item.from),
  ].sort()[0];
  const first = firstDay === undefined ? -1 : scenario.rows.findIndex(row => row.date >= firstDay);
  const after = first >= 0 ? scenario.rows[first + 1] : undefined;
  return {
    baseline: summaryOf(baseline),
    scenario: summaryOf(scenario),
    monthsSaved: baseline.periods - scenario.periods,
    interestSaved: fromMinor(toMinor(baseline.totalInterest) - toMinor(scenario.totalInterest)),
    paymentBefore: after ? (baseline.rows[first + 1]?.payment ?? null) : null,
    paymentAfter: after ? after.payment : null,
  };
}
