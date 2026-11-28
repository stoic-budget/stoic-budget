import { occurrencesFrom } from '../../../../src/common/recurrence/recurrence';
import { buildSchedule, type LoanPlanInput } from '../../../../src/modules/loans/engine/loan-plan';
import { amountsByDate, reminderRule } from '../../../../src/modules/loans/loan-reminder-series';

const base: LoanPlanInput = {
  principal: 10_000,
  startDate: '2026-01-05',
  termMonths: 14,
  paymentDay: 31,
  method: 'annuity',
  dayCount: '30/360',
  annualRate: 7.5,
  rateChanges: [],
  extraPayments: [],
  recurringExtras: [],
  extraMode: 'reduce_term',
};

const datesOf = (input: LoanPlanInput) => {
  const rows = buildSchedule(input).rows;
  const rule = reminderRule(rows, input.paymentDay);
  return { rows, dates: [...occurrencesFrom(rule, rule.startDate)] };
};

/** The bill series puts a bill on every payment date of the schedule, and on no other day. */
describe('reminderRule', () => {
  it.each([
    ['the 31st, pulled back in short months and February', base],
    ['the 29th across a leap year', { ...base, paymentDay: 29, startDate: '2027-12-20', termMonths: 30 }],
    ['linear, the 1st', { ...base, method: 'linear' as const, paymentDay: 1 }],
    ['ended early by an extra payment', { ...base, extraPayments: [{ date: '2026-06-30', amount: 4_000 }] }],
  ])('follows the schedule: %s', (_name, input) => {
    const { rows, dates } = datesOf(input);
    expect(dates).toEqual(rows.map(row => row.date));
  });

  it('ends with the loan: an extra payment that shortens it shortens the series', () => {
    const plain = datesOf(base).dates.length;
    const shorter = datesOf({ ...base, extraPayments: [{ date: '2026-06-30', amount: 4_000 }] });
    expect(shorter.dates.length).toBeLessThan(plain);
  });
});

describe('amountsByDate', () => {
  it('asks for the payment and the extra planned on that date', () => {
    const input = { ...base, extraPayments: [{ date: '2026-06-30', amount: 500 }] };
    const rows = buildSchedule(input).rows;
    const amounts = amountsByDate(rows);
    for (const row of rows) {
      expect(amounts.get(row.date)).toBeCloseTo(row.payment + row.extra, 2);
    }
    expect(rows.some(row => row.extra > 0)).toBe(true);
  });
});
