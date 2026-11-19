import { toMinor } from '../../../../src/common/utils/money.util';
import {
  carriedFactor,
  type ExtraMode,
} from '../../../../src/modules/loans/engine/loan-amortization';
import {
  buildSchedule,
  type LoanPlanInput,
  paymentDates,
  roundsWithinTerm,
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
    termMonths: random.int(1, 480),
    paymentDay: random.pick([random.int(1, 31), Number(startDate.slice(8))]),
    method: random.pick(['annuity', 'linear'] as const),
    dayCount: random.pick(['30/360', 'actual/365'] as const),
    annualRate: random.int(0, 250_000) / 10_000,
    rateChanges: [],
    extraPayments: [],
    recurringExtras: [],
    extraMode: random.pick(['reduce_term', 'reduce_payment'] as const),
  };
}

const sumCents = (values: number[]) => values.reduce((sum, value) => sum + toMinor(value), 0);

/**
 * The most the last payment can differ from the regular one by rounding: a
 * cent a period (half for the payment, half for the interest), carried with
 * the interest of a 31-day month to the end of the term.
 */
const residue = (input: LoanPlanInput) =>
  carriedFactor(input.annualRate, Array(input.termMonths).fill(31 / 365)) / 100;

/**
 * Random loans under both day counts against what every schedule must hold:
 * the principal parts and extra payments add up to the principal to the cent,
 * the balance ends at zero, and without extra payments the loan ends on its
 * term in level payments (the annuity's, or the linear principal part), the
 * first carrying a broken first period's own days and the last only the
 * rounding. Terms whose rounding outgrows a payment are refused on save
 * (`roundsWithinTerm`), so they are left out here too.
 */
describe('loan schedules over random loans', () => {
  const random = generator(744);
  // Some 3,000 schedules in all: each test gets more than the default 5 seconds on a busy machine.
  const loans = Array.from({ length: 400 }, () => randomLoan(random)).filter(roundsWithinTerm);

  it('ends on the term in level payments, the last taking only the residue', () => {
    expect(loans.length).toBeGreaterThan(300);
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
        .slice(1, -1)
        .map(row => (input.method === 'annuity' ? row.payment : row.principal));
      expect({ label, level: new Set(level).size <= 1 }).toEqual({ label, level: true });
      if (input.method === 'annuity' && rows.length > 2) {
        expect({ label, regular: rows[1].payment }).toEqual({ label, regular: schedule.regularPayment });
        expect({
          label,
          off: Math.abs(last.payment - schedule.regularPayment) <= residue(input),
        }).toEqual({ label, off: true });
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
      const planned = { ...input, extraPayments, recurringExtras };
      const schedule = buildSchedule(planned);
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
      // Extra payments never raise an annuity's payment past the regular one
      // (the first may carry a broken period's days, the last the rounding).
      const highest = schedule.regularPayment + residue(input);
      const capped = input.method !== 'annuity' || rows.slice(1).every(row => row.payment <= highest);
      expect({ label, capped }).toEqual({ label, capped: true });
      expect(rows.every(row => row.extra >= 0)).toBe(true);

      // A what-if never makes the loan longer, nor dearer than the plan it is
      // tried on beyond the rounding both carry: a lower payment worked out
      // again rounds to the cent anew, and a long term at a high rate carries
      // that cent a long way (see `residue`).
      const tried = whatIf(planned, {
        extraPayments: [{ date: anyDay(), amount: 100 }],
        recurringExtras: [],
        extraMode: mode(),
      });
      expect({
        label,
        saved: tried.monthsSaved >= 0 && tried.interestSaved >= -residue(input),
      }).toEqual({ label, saved: true });
    }
  }, 30_000);
});
