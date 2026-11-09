import { fromMinor, toMinor } from '../../../../src/common/utils/money.util';
import {
  annuityPayment,
  periodsToRepay,
} from '../../../../src/modules/loans/engine/loan-amortization';
import {
  actualDays,
  days360,
  isPaymentDay,
  paymentDateAfter,
} from '../../../../src/modules/loans/engine/loan-calendar';
import {
  buildSchedule,
  type LoanPlanInput,
  paymentDates,
  projectSchedule,
  whatIf,
} from '../../../../src/modules/loans/engine/loan-plan';

const loan = (patch: Partial<LoanPlanInput> = {}): LoanPlanInput => ({
  principal: 10_000,
  startDate: '2026-01-15',
  termMonths: 12,
  paymentDay: 15,
  method: 'annuity',
  dayCount: '30/360',
  annualRate: 12,
  rateChanges: [],
  extraPayments: [],
  recurringExtras: [],
  extraMode: 'reduce_term',
  ...patch,
});

const cents = (values: number[]) => values.reduce((sum, value) => sum + toMinor(value), 0);
const repaid = (rows: Array<{ principal: number; extra: number }>) =>
  cents(rows.map(row => row.principal)) + cents(rows.map(row => row.extra));

describe('loan calendar', () => {
  it('pulls a payment day back to the end of a short month', () => {
    expect(paymentDateAfter('2026-01-31', 1, 31)).toBe('2026-02-28');
    expect(paymentDateAfter('2026-01-31', 3, 31)).toBe('2026-04-30');
    expect(paymentDateAfter('2027-12-31', 2, 29)).toBe('2028-02-29');
    expect(paymentDateAfter('2026-11-10', 2, 5)).toBe('2027-01-05');
  });

  it('knows a start on the payment day of its month', () => {
    expect(isPaymentDay('2026-02-28', 31)).toBe(true);
    expect(isPaymentDay('2026-01-15', 1)).toBe(false);
  });

  it('counts actual days and 30E/360 days', () => {
    expect(actualDays('2026-01-15', '2026-02-01')).toBe(17);
    expect(actualDays('2026-03-28', '2026-03-30')).toBe(2);
    expect(days360('2026-01-15', '2026-02-01')).toBe(16);
    expect(days360('2026-01-31', '2026-02-28')).toBe(30);
    expect(days360('2026-01-01', '2027-01-01')).toBe(360);
  });
});

describe('annuity payment', () => {
  it('matches the textbook values', () => {
    expect(fromMinor(annuityPayment(toMinor(100_000), 6, 360))).toBe(599.55);
    expect(fromMinor(annuityPayment(toMinor(200_000), 5, 360))).toBe(1073.64);
    expect(fromMinor(annuityPayment(toMinor(10_000), 12, 12))).toBe(888.49);
  });

  it('splits a zero-rate loan evenly', () => {
    expect(fromMinor(annuityPayment(toMinor(1_000), 0, 3))).toBe(333.33);
  });

  it('knows how long a payment takes, and when it never repays', () => {
    expect(periodsToRepay(toMinor(10_000), toMinor(888.49), 12)).toBe(12);
    expect(periodsToRepay(toMinor(1_000), toMinor(100), 0)).toBe(10);
    expect(periodsToRepay(toMinor(10_000), toMinor(100), 12)).toBe(Number.POSITIVE_INFINITY);
  });
});

describe('buildSchedule', () => {
  it('repays an annuity in level payments, the residue in the last one', () => {
    const schedule = buildSchedule(loan());
    expect(schedule.periods).toBe(12);
    expect(schedule.regularPayment).toBe(888.49);
    expect(schedule.rows.slice(0, 11).every(row => row.payment === 888.49)).toBe(true);
    expect(Math.abs(schedule.rows[11].payment - 888.49)).toBeLessThan(0.1);
    expect(schedule.rows[0].interest).toBe(100);
    expect(repaid(schedule.rows)).toBe(toMinor(10_000));
    expect(schedule.rows[11].balance).toBe(0);
    expect(schedule.payoffDate).toBe('2027-01-15');
    expect(toMinor(schedule.totalPaid)).toBe(toMinor(10_000) + toMinor(schedule.totalInterest));
  });

  it('repays the same principal each month on a linear loan', () => {
    const schedule = buildSchedule(loan({ method: 'linear', principal: 12_000 }));
    expect(schedule.rows.map(row => row.principal)).toEqual(Array(12).fill(1000));
    expect(schedule.rows.map(row => row.interest)).toEqual([
      120, 110, 100, 90, 80, 70, 60, 50, 40, 30, 20, 10,
    ]);
    expect(schedule.totalInterest).toBe(780);
    expect(schedule.regularPayment).toBe(1120);
  });

  it('charges only interest, then the whole balance at the end, on an interest-only loan', () => {
    const schedule = buildSchedule(loan({ method: 'interest_only', annualRate: 6 }));
    expect(schedule.rows.slice(0, 11).every(row => row.payment === 50 && row.principal === 0)).toBe(
      true,
    );
    expect(schedule.rows[11]).toMatchObject({ principal: 10_000, payment: 10_050, balance: 0 });
    expect(schedule.totalInterest).toBe(600);
  });

  it('charges no interest at zero rate and puts the odd cent last', () => {
    const schedule = buildSchedule(loan({ principal: 1_000, termMonths: 3, annualRate: 0 }));
    expect(schedule.rows.map(row => row.payment)).toEqual([333.33, 333.33, 333.34]);
    expect(schedule.totalInterest).toBe(0);
  });

  it('counts a broken first period by days: 30/360 and actual/365 differ', () => {
    const terms = { method: 'linear' as const, principal: 12_000, paymentDay: 1 };
    const thirty = buildSchedule(loan(terms));
    const actual = buildSchedule(loan({ ...terms, dayCount: 'actual/365' }));
    expect(thirty.rows[0].date).toBe('2026-02-01');
    // 16 days of 360 against 17 of 365.
    expect(thirty.rows[0].interest).toBe(64);
    expect(actual.rows[0].interest).toBe(67.07);
    // After it, 30/360 is a twelfth of a year; actual/365 counts February's 28 days.
    expect(thirty.rows[1].interest).toBe(110);
    expect(actual.rows[1].interest).toBe(101.26);
  });

  it('repays an actual/365 annuity exactly despite uneven months', () => {
    const schedule = buildSchedule(loan({ dayCount: 'actual/365', termMonths: 60 }));
    expect(repaid(schedule.rows)).toBe(toMinor(10_000));
    expect(schedule.periods).toBe(60);
  });

  it('works the payment out again when the rate changes on a payment date', () => {
    const base = loan({ principal: 100_000, annualRate: 6, termMonths: 360, startDate: '2026-01-01', paymentDay: 1 });
    const plain = buildSchedule(base);
    const changed = buildSchedule({ ...base, rateChanges: [{ from: plain.rows[11].date, annualRate: 3 }] });
    const left = toMinor(changed.rows[11].balance);
    expect(changed.rows[11].payment).toBe(599.55);
    expect(changed.rows[12].payment).toBe(fromMinor(annuityPayment(left, 3, 348)));
    expect(changed.rows[12].interest).toBe(fromMinor(Math.round((left * 0.03) / 12)));
    expect(changed.rows[12].annualRate).toBe(3);
    expect(changed.periods).toBe(360);
    expect(repaid(changed.rows)).toBe(toMinor(100_000));
    expect(changed.totalInterest).toBeLessThan(plain.totalInterest);
  });

  it('splits a period at a rate change inside it', () => {
    const terms = {
      method: 'linear' as const,
      principal: 12_000,
      startDate: '2026-01-01',
      paymentDay: 1,
      rateChanges: [{ from: '2026-01-16', annualRate: 24 }],
    };
    // 15 days at 12% and the rest of the month at 24%.
    expect(buildSchedule(loan(terms)).rows[0]).toMatchObject({ interest: 180, annualRate: 24 });
    expect(buildSchedule(loan({ ...terms, dayCount: 'actual/365' })).rows[0].interest).toBe(185.42);
  });

  it('keeps the payment and ends earlier when an extra payment reduces the term', () => {
    const date = paymentDates(loan())[2];
    const schedule = buildSchedule(loan({ extraPayments: [{ date, amount: 2_000 }] }));
    expect(schedule.rows[2].extra).toBe(2_000);
    expect(schedule.rows.slice(3, -1).every(row => row.payment === 888.49)).toBe(true);
    expect(schedule.periods).toBeLessThan(12);
    expect(repaid(schedule.rows)).toBe(toMinor(10_000));
  });

  it('keeps the term and lowers the payment when an extra payment reduces the payment', () => {
    const date = paymentDates(loan())[2];
    const schedule = buildSchedule(
      loan({ extraPayments: [{ date, amount: 2_000 }], extraMode: 'reduce_payment' }),
    );
    expect(schedule.periods).toBe(12);
    const left = toMinor(schedule.rows[2].balance);
    expect(schedule.rows[3].payment).toBe(fromMinor(annuityPayment(left, 12, 9)));
    expect(schedule.rows[3].payment).toBeLessThan(888.49);
    expect(repaid(schedule.rows)).toBe(toMinor(10_000));
  });

  it('lowers the interest from the day of an extra payment inside a period', () => {
    const schedule = buildSchedule(
      loan({
        method: 'linear',
        principal: 12_000,
        startDate: '2026-01-01',
        paymentDay: 1,
        extraPayments: [{ date: '2026-01-16', amount: 6_000 }],
      }),
    );
    expect(schedule.rows[0]).toMatchObject({ interest: 90, principal: 1000, extra: 6000, balance: 5000 });
    // The linear part stays 1,000: five more months.
    expect(schedule.periods).toBe(6);
  });

  it('ends the loan when an extra payment covers the balance, never paying more', () => {
    const date = paymentDates(loan())[0];
    const schedule = buildSchedule(loan({ extraPayments: [{ date, amount: 50_000 }] }));
    expect(schedule.periods).toBe(1);
    expect(schedule.rows[0].balance).toBe(0);
    expect(repaid(schedule.rows)).toBe(toMinor(10_000));
  });

  it('adds a monthly extra from its first day on', () => {
    const from = paymentDates(loan())[3];
    const schedule = buildSchedule(loan({ recurringExtras: [{ from, amount: 500 }] }));
    expect(schedule.rows.slice(0, 3).every(row => row.extra === 0)).toBe(true);
    expect(schedule.rows[3].extra).toBe(500);
    expect(schedule.periods).toBeLessThan(12);
    expect(repaid(schedule.rows)).toBe(toMinor(10_000));
  });

  it('charges a twelfth of a year for every whole month under 30/360, even on day 29', () => {
    // 29 January to 28 February counts 31 days under 30E/360, to 29 March 29 days.
    const terms = { startDate: '2026-01-29', paymentDay: 29 };
    const schedule = buildSchedule(loan(terms));
    expect(schedule.rows[0]).toMatchObject({ date: '2026-02-28', interest: 100 });
    const left = toMinor(schedule.rows[0].balance);
    expect(schedule.rows[1]).toMatchObject({ date: '2026-03-29' });
    expect(schedule.rows[1].interest).toBe(fromMinor(Math.round(left / 100)));
  });

  describe('a rate change after extra payments cut the term', () => {
    const dates = paymentDates(loan());
    const shortened = (principal: number, annualRate: number) =>
      loan({
        principal,
        extraPayments: [{ date: dates[1], amount: 3_000 }],
        rateChanges: [{ from: dates[4], annualRate }],
      });

    it('keeps the shorter term', () => {
      const schedule = buildSchedule(shortened(10_000, 6));
      const plain = buildSchedule(loan({ principal: 10_000, extraPayments: [{ date: dates[1], amount: 3_000 }] }));
      expect(schedule.periods).toBe(plain.periods);
      expect(schedule.periods).toBeLessThan(12);
    });

    it('puts the rounding residue into the last payment, never a period of its own', () => {
      for (const principal of [10_007, 10_021]) {
        for (const annualRate of [0, 3, 4.5, 6, 7.25]) {
          const schedule = buildSchedule(shortened(principal, annualRate));
          const plain = buildSchedule(loan({ principal, extraPayments: [{ date: dates[1], amount: 3_000 }] }));
          const last = schedule.rows[schedule.rows.length - 1];
          expect({ principal, annualRate, periods: schedule.periods }).toEqual({
            principal,
            annualRate,
            periods: plain.periods,
          });
          expect(last.payment).toBeGreaterThan(schedule.rows[schedule.rows.length - 2].payment / 2);
          expect(last.balance).toBe(0);
          expect(repaid(schedule.rows)).toBe(toMinor(principal));
        }
      }
    });
  });

  it('ignores extra payments dated before the loan started', () => {
    const schedule = buildSchedule(loan({ extraPayments: [{ date: '2025-12-01', amount: 500 }] }));
    expect(schedule).toEqual(buildSchedule(loan()));
  });
});

describe('projectSchedule', () => {
  const terms = loan({ principal: 12_000 });
  const plan = buildSchedule(terms);
  const today = '2026-05-20';

  it('keeps the planned payment when ahead, so the loan ends earlier', () => {
    const ahead = projectSchedule(terms, today, plan.rows[3].balance - 2_000);
    expect(ahead?.from).toBe('2026-05-15');
    expect(ahead?.rows[0].date).toBe('2026-06-15');
    expect(ahead?.rows[0].payment).toBe(plan.rows[4].payment);
    expect(ahead?.periods).toBeLessThan(8);
  });

  it('raises the payment when behind, to still finish on time', () => {
    const behind = projectSchedule(terms, today, plan.rows[3].balance + 1_000);
    expect(behind?.periods).toBe(8);
    expect(behind?.rows[0].payment).toBeGreaterThan(plan.rows[4].payment);
    expect(behind?.payoffDate).toBe(plan.payoffDate);
  });

  it('follows the plan when the balance is on plan', () => {
    const onPlan = projectSchedule(terms, today, plan.rows[3].balance);
    expect(onPlan?.rows.map(row => row.balance)).toEqual(plan.rows.slice(4).map(row => row.balance));
  });

  it('has nothing to project when paid off or past the last payment date', () => {
    expect(projectSchedule(terms, today, 0)).toBeNull();
    expect(projectSchedule(terms, '2027-02-01', 500)).toBeNull();
  });
});

describe('whatIf', () => {
  it('saves months and interest when extra payments reduce the term', () => {
    const from = paymentDates(loan())[0];
    const result = whatIf(loan(), {
      extraPayments: [],
      recurringExtras: [{ from, amount: 300 }],
      extraMode: 'reduce_term',
    });
    expect(result.monthsSaved).toBe(result.baseline.periods - result.scenario.periods);
    expect(result.monthsSaved).toBeGreaterThan(0);
    expect(result.interestSaved).toBeGreaterThan(0);
    expect(toMinor(result.interestSaved)).toBe(
      toMinor(result.baseline.totalInterest) - toMinor(result.scenario.totalInterest),
    );
  });

  it('keeps the term and names the lower payment when extra payments reduce the payment', () => {
    const date = paymentDates(loan())[1];
    const result = whatIf(loan(), {
      extraPayments: [{ date, amount: 3_000 }],
      recurringExtras: [],
      extraMode: 'reduce_payment',
    });
    expect(result.monthsSaved).toBe(0);
    expect(result.interestSaved).toBeGreaterThan(0);
    expect(result.paymentBefore).toBe(888.49);
    expect(result.paymentAfter).toBeLessThan(888.49);
  });

  it('saves nothing without extra payments', () => {
    const result = whatIf(loan(), { extraPayments: [], recurringExtras: [], extraMode: 'reduce_term' });
    expect(result).toMatchObject({ monthsSaved: 0, interestSaved: 0, paymentAfter: null });
  });
});
