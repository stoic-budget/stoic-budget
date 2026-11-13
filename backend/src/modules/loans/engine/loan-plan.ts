import { fromMinor, roundHalfAwayFromZero, toMinor } from '../../../common/utils/money.util';
import {
  type AmortizationRun,
  amortize,
  annuityPayment,
  type DayCount,
  type ExtraMode,
  type LoanMethod,
  type MinorRow,
} from './loan-amortization';
import { isPaymentDay, paymentDateAfter } from './loan-calendar';

/** A loan's terms in major units and percent, as stored. */
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
  extraPayments: ReadonlyArray<{ date: string; amount: number }>;
  recurringExtras: ReadonlyArray<{ from: string; amount: number }>;
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

/** The payment dates of the whole term, oldest first. */
export function paymentDates(
  input: Pick<LoanPlanInput, 'startDate' | 'termMonths' | 'paymentDay'>,
) {
  return Array.from({ length: input.termMonths }, (_, index) =>
    paymentDateAfter(input.startDate, index + 1, input.paymentDay),
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
    method: input.method,
    dayCount: input.dayCount,
    rates: [
      { from: '', annualRate: input.annualRate },
      ...[...input.rateChanges].sort((a, b) => a.from.localeCompare(b.from)),
    ],
    extras: input.extraPayments
      .map(extra => ({ date: extra.date, amount: toMinor(extra.amount) }))
      .sort((a, b) => a.date.localeCompare(b.date)),
    recurring: input.recurringExtras.map(item => ({
      from: item.from,
      amount: toMinor(item.amount),
    })),
    mode: input.extraMode,
  };
}

function regularPaymentOf(input: LoanPlanInput, principal: number): number {
  const interest = roundHalfAwayFromZero((principal * input.annualRate) / 1200);
  if (input.method === 'annuity') {
    return annuityPayment(principal, input.annualRate, input.termMonths);
  }
  if (input.method === 'linear') {
    return roundHalfAwayFromZero(principal / input.termMonths) + interest;
  }
  return interest;
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

function planRows(input: LoanPlanInput): MinorRow[] {
  return amortize(
    runOf(
      input,
      toMinor(input.principal),
      input.startDate,
      paymentDates(input),
      isPaymentDay(input.startDate, input.paymentDay),
    ),
  );
}

/** The whole schedule the terms describe, from the start date. */
export function buildSchedule(input: LoanPlanInput): Schedule {
  return toSchedule(planRows(input), regularPaymentOf(input, toMinor(input.principal)));
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
    const planned = planRows(input);
    const next = planned[past];
    if (next && past < planned.length - 1) {
      run.keep = input.method === 'annuity' ? next.payment : next.principal;
    }
  }
  const rows = amortize(run);
  return {
    ...toSchedule(rows, rows[0]?.payment ?? 0),
    from,
    startBalance: fromMinor(balance),
  };
}

export interface WhatIfResult {
  baseline: ScheduleSummary;
  scenario: ScheduleSummary;
  monthsSaved: number;
  interestSaved: number;
  /** After the first extra payment: the payment as planned and as it would be. */
  paymentBefore: number | null;
  paymentAfter: number | null;
}

const summaryOf = ({ rows: _rows, ...summary }: Schedule): ScheduleSummary => summary;

/** The plan against the plan plus some extra payments, all made in `mode`. */
export function whatIf(
  input: LoanPlanInput,
  extra: Pick<LoanPlanInput, 'extraPayments' | 'recurringExtras' | 'extraMode'>,
): WhatIfResult {
  const baseline = buildSchedule(input);
  const scenario = buildSchedule({
    ...input,
    extraPayments: [...input.extraPayments, ...extra.extraPayments],
    recurringExtras: [...input.recurringExtras, ...extra.recurringExtras],
    extraMode: extra.extraMode,
  });
  const first = scenario.rows.findIndex(row => row.extra > 0);
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
