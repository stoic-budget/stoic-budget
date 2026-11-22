import { toMinor } from '../../../../src/common/utils/money.util';
import {
  MATCH_WINDOW_DAYS,
  type PlannerPayment,
  planPayments,
} from '../../../../src/modules/loans/engine/loan-payment-planner';
import { buildSchedule, type LoanPlanInput } from '../../../../src/modules/loans/engine/loan-plan';

const terms = (patch: Partial<LoanPlanInput> = {}): LoanPlanInput => ({
  principal: 12_000,
  startDate: '2026-01-15',
  termMonths: 12,
  paymentDay: 15,
  method: 'annuity',
  dayCount: '30/360',
  annualRate: 6,
  rateChanges: [],
  extraPayments: [],
  recurringExtras: [],
  extraMode: 'reduce_term',
  ...patch,
});

const loanOf = (input: LoanPlanInput) => ({ currency: 'EUR', startDate: input.startDate });

const pay = (id: string, date: string, amount: number, currency = 'EUR'): PlannerPayment => ({
  id,
  date,
  amount,
  currency,
});

const shiftDays = (date: string, days: number) =>
  new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);

describe('planPayments', () => {
  const input = terms();
  const rows = buildSchedule(input).rows;

  it('gives a payment made as planned the period’s interest, the rest to principal', () => {
    const plans = planPayments(rows, [pay('a', rows[0].date, rows[0].payment)], loanOf(input));
    expect(plans.get('a')).toEqual({
      blocked: null,
      suggestion: {
        period: 1,
        scheduledPayment: rows[0].payment,
        interest: rows[0].interest,
        principal: rows[0].principal,
      },
    });
    // 12 000 at 6 % a year, 30/360: a month of interest is 60.
    expect(rows[0].interest).toBe(60);
  });

  it('puts what is paid beyond the plan into principal', () => {
    const amount = rows[0].payment + 250;
    const plan = planPayments(rows, [pay('a', rows[0].date, amount)], loanOf(input)).get('a');
    expect(plan?.suggestion?.interest).toBe(rows[0].interest);
    expect(toMinor(plan?.suggestion?.principal ?? 0)).toBe(
      toMinor(amount) - toMinor(rows[0].interest),
    );
  });

  it('never makes the interest more than the payment', () => {
    const plan = planPayments(rows, [pay('a', rows[0].date, 25)], loanOf(input)).get('a');
    expect(plan?.suggestion).toMatchObject({ period: 1, interest: 25, principal: 0 });
  });

  it('matches a payment a few days late, and none outside the window', () => {
    const late = shiftDays(rows[1].date, 4);
    const far = shiftDays(rows[1].date, MATCH_WINDOW_DAYS + 1);
    // Between two payment dates more than the window away from both.
    const plans = planPayments(
      rows.slice(1, 2),
      [pay('late', late, rows[1].payment), pay('far', far, rows[1].payment)],
      loanOf(input),
    );
    expect(plans.get('late')?.suggestion?.period).toBe(2);
    expect(plans.get('far')?.suggestion).toEqual({
      period: null,
      scheduledPayment: null,
      interest: 0,
      principal: rows[1].payment,
    });
  });

  it('gives one period to one payment: the regular one, not the extra beside it', () => {
    const plans = planPayments(
      rows,
      [
        // A lump sum two days before the instalment, closer in date but not in amount.
        pay('extra', shiftDays(rows[2].date, -2), 3_000),
        pay('regular', shiftDays(rows[2].date, 3), rows[2].payment),
      ],
      loanOf(input),
    );
    expect(plans.get('regular')?.suggestion).toMatchObject({ period: 3, interest: rows[2].interest });
    expect(plans.get('extra')?.suggestion).toMatchObject({
      period: null,
      interest: 0,
      principal: 3_000,
    });
  });

  it('makes an interest-only loan’s regular payment all interest', () => {
    const interestOnly = terms({ method: 'interest_only' });
    const schedule = buildSchedule(interestOnly).rows;
    const plan = planPayments(
      schedule,
      [pay('a', schedule[0].date, schedule[0].payment)],
      loanOf(interestOnly),
    ).get('a');
    expect(plan?.suggestion).toMatchObject({ interest: 60, principal: 0 });
  });

  it('counts a planned extra payment into what the period asked for', () => {
    const withExtra = terms({ extraPayments: [{ date: '2026-02-15', amount: 500 }] });
    const schedule = buildSchedule(withExtra).rows;
    const asked = schedule[0].payment + schedule[0].extra;
    const plan = planPayments(schedule, [pay('a', schedule[0].date, asked)], loanOf(withExtra)).get(
      'a',
    );
    expect(plan?.suggestion?.scheduledPayment).toBe(asked);
    expect(plan?.suggestion?.interest).toBe(schedule[0].interest);
  });

  it('does not divide a payment before the loan starts or in another currency', () => {
    const plans = planPayments(
      rows,
      [
        pay('early', '2026-01-10', 500),
        pay('dollars', rows[0].date, rows[0].payment, 'USD'),
        pay('euros', rows[0].date, rows[0].payment, ' eur '),
      ],
      loanOf(input),
    );
    expect(plans.get('early')).toEqual({ suggestion: null, blocked: 'before_start' });
    expect(plans.get('dollars')).toEqual({ suggestion: null, blocked: 'other_currency' });
    // A blocked payment takes no period away from a good one.
    expect(plans.get('euros')?.suggestion?.period).toBe(1);
  });
});
