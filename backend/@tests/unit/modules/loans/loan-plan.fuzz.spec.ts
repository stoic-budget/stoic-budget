import { toMinor } from '../../../../src/common/utils/money.util';
import type { ExtraMode } from '../../../../src/modules/loans/engine/loan-amortization';
import {
  buildSchedule,
  type LoanPlanInput,
  paymentDates,
  whatIf,
} from '../../../../src/modules/loans/engine/loan-plan';

/** A seeded generator (mulberry32): the same loans on every run, so a failure can be replayed. */
function generator(seed: number) {
  let state = seed;
  const next = () => {
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
  const int = (min: number, max: number) => min + Math.floor(next() * (max - min + 1));
  const pick = <T>(items: readonly T[]) => items[int(0, items.length - 1)];
  return { int, pick };
}

const day = (year: number, month: number, date: number) =>
  `${year}-${String(month).padStart(2, '0')}-${String(date).padStart(2, '0')}`;

function randomLoan(random: ReturnType<typeof generator>): LoanPlanInput {
  const startDate = day(random.int(2020, 2030), random.int(1, 12), random.int(1, 28));
  return {
    principal: random.int(1_000_00, 1_000_000_00) / 100,
    startDate,
    termMonths: random.int(1, 360),
    paymentDay: random.pick([random.int(1, 31), Number(startDate.slice(8))]),
    method: random.pick(['annuity', 'linear'] as const),
    dayCount: random.pick(['30/360', 'actual/365'] as const),
    annualRate: random.int(0, 120_000) / 10_000,
    rateChanges: [],
    extraPayments: [],
    recurringExtras: [],
    extraMode: random.pick(['reduce_term', 'reduce_payment'] as const),
  };
}

const sumCents = (values: number[]) => values.reduce((sum, value) => sum + toMinor(value), 0);

/**
 * Random loans against what every schedule must hold: the principal parts and
 * extra payments add up to the principal to the cent, the balance ends at
 * zero, and without extra payments the loan ends on its term in level
 * payments (the annuity's, or the linear principal part).
 */
describe('loan schedules over random loans', () => {
  const random = generator(744);
  // Some 3,000 schedules in all: each test gets more than the default 5 seconds on a busy machine.
  const loans = Array.from({ length: 400 }, () => randomLoan(random));

  it('ends on the term in level payments, the last taking only the residue', () => {
    for (const input of loans) {
      const schedule = buildSchedule(input);
      const dates = paymentDates(input);
      const rows = schedule.rows;
      const last = rows[rows.length - 1];
      const label = JSON.stringify(input);
      expect({ label, periods: schedule.periods }).toEqual({ label, periods: input.termMonths });
      expect(schedule.payoffDate).toBe(dates[dates.length - 1]);
      expect(last.balance).toBe(0);
      expect(sumCents(rows.map(row => row.principal))).toBe(toMinor(input.principal));
      expect(toMinor(schedule.totalPaid)).toBe(
        toMinor(input.principal) + toMinor(schedule.totalInterest),
      );
      const level = rows
        .slice(0, -1)
        .map(row => (input.method === 'annuity' ? row.payment : row.principal));
      expect({ label, level: new Set(level).size <= 1 }).toEqual({ label, level: true });
      if (input.method === 'annuity' && input.dayCount === '30/360' && rows.length > 1) {
        // Only rounding: up to a cent a month (the payment's and the interest's
        // half cents), carried with interest to the end of the term.
        const monthly = input.annualRate / 1200;
        const carried =
          monthly === 0 ? rows.length : ((1 + monthly) ** rows.length - 1) / monthly;
        expect({ label, off: Math.abs(last.payment - rows[0].payment) <= carried / 100 }).toEqual({
          label,
          off: true,
        });
      }
    }
  }, 30_000);

  it('repays exactly the principal with extra payments in either mode, on any day of the term', () => {
    for (const input of loans) {
      const dates = paymentDates(input);
      const anyDay = () => {
        const index = random.int(0, dates.length - 1);
        const from = index === 0 ? input.startDate : dates[index - 1];
        return random.pick([from, dates[index]]);
      };
      const mode = () => random.pick<ExtraMode>(['reduce_term', 'reduce_payment']);
      const extraPayments = Array.from({ length: random.int(0, 4) }, () => ({
        date: anyDay(),
        amount: random.int(1, toMinor(input.principal) / 4) / 100,
        mode: mode(),
      }));
      const recurringExtras = random.pick([
        [],
        [{ from: anyDay(), amount: random.int(1, toMinor(input.principal) / 50) / 100, mode: mode() }],
      ]);
      const schedule = buildSchedule({ ...input, extraPayments, recurringExtras });
      const rows = schedule.rows;
      const label = JSON.stringify({ input, extraPayments, recurringExtras });
      expect({ label, balance: rows[rows.length - 1].balance }).toEqual({ label, balance: 0 });
      expect({ label, periods: schedule.periods <= input.termMonths }).toEqual({
        label,
        periods: true,
      });
      expect({
        label,
        repaid: sumCents(rows.map(row => row.principal)) + sumCents(rows.map(row => row.extra)),
      }).toEqual({ label, repaid: toMinor(input.principal) });
      expect(rows.slice(1).every(row => row.payment >= 0 && row.extra >= 0)).toBe(true);

      // A what-if never makes the loan longer, nor (where every month is a
      // twelfth of a year) dearer than the plan it is tried on. Under
      // actual/365 a lower payment is worked out again on twelfths, so it can
      // give back what short months had saved.
      const tried = whatIf(
        { ...input, extraPayments, recurringExtras },
        { extraPayments: [{ date: anyDay(), amount: 100 }], recurringExtras: [], extraMode: mode() },
      );
      const dearer = input.dayCount === '30/360' && tried.interestSaved < -0.05;
      expect({ label, saved: tried.monthsSaved >= 0 && !dearer }).toEqual({ label, saved: true });
    }
  }, 30_000);
});
