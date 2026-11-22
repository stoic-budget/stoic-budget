import { fromMinor, toMinor } from '../../../../src/common/utils/money.util';
import {
  annuityPayment,
  carriedFactor,
  levelPayment,
} from '../../../../src/modules/loans/engine/loan-amortization';
import {
  actualDays,
  days360,
  firstPaymentMonth,
  isPaymentDay,
  MIN_FIRST_PERIOD_DAYS,
  paymentDateAfter,
} from '../../../../src/modules/loans/engine/loan-calendar';
import {
  buildSchedule,
  type LoanPlanInput,
  paymentDates,
  projectSchedule,
  roundsWithinTerm,
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

  it('puts the first payment on the first payment day at least half a month after the start', () => {
    const first = (startDate: string, paymentDay: number) =>
      paymentDates({ startDate, paymentDay, termMonths: 2 })[0];
    // 31 March is 28 days after 3 March: the first payment, not 30 April 58 days on.
    expect(first('2026-03-03', 31)).toBe('2026-03-31');
    expect(firstPaymentMonth('2026-03-03', 31)).toBe(0);
    // 1 February is only 12 days after 20 January: the first payment waits for 1 March.
    expect(first('2026-01-20', 1)).toBe('2026-03-01');
    expect(first('2026-01-15', 1)).toBe('2026-02-01');
    // The shortest first period is MIN_FIRST_PERIOD_DAYS, one day less moves it a month.
    expect(MIN_FIRST_PERIOD_DAYS).toBe(15);
    expect(actualDays('2026-01-17', first('2026-01-17', 1))).toBe(15);
    expect(first('2026-01-18', 1)).toBe('2026-03-01');
    // A start on the payment day pays a whole month later.
    expect(first('2026-01-15', 15)).toBe('2026-02-15');
    expect(first('2026-02-28', 31)).toBe('2026-03-31');
    expect(paymentDates({ startDate: '2026-03-03', paymentDay: 31, termMonths: 3 })).toEqual([
      '2026-03-31',
      '2026-04-30',
      '2026-05-31',
    ]);
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

  it('solves over the real length of each period, to the cent', () => {
    // Under actual/365 a month is its days: 31, 28 and 31 of them.
    const months = [31, 28, 31].map(days => days / 365);
    const payment = levelPayment(toMinor(1_000), 12, months);
    const owed = months.reduce((left, part) => left * (1 + 0.12 * part) - payment, toMinor(1_000));
    expect(Math.abs(owed)).toBeLessThan(1);
    expect(levelPayment(toMinor(1_000), 12, Array(3).fill(1 / 12))).toBe(
      annuityPayment(toMinor(1_000), 12, 3),
    );
  });

  it('carries a cent a period with interest to the end of the term', () => {
    expect(carriedFactor(0, Array(3).fill(1 / 12))).toBe(3);
    expect(carriedFactor(12, Array(12).fill(1 / 12))).toBeCloseTo((1.01 ** 12 - 1) / 0.01, 9);
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

  it('quotes the textbook payment for a start on the payment day', () => {
    const start = { startDate: '2026-01-01', paymentDay: 1 };
    expect(buildSchedule(loan({ ...start, principal: 100_000, annualRate: 6, termMonths: 360 })).regularPayment).toBe(599.55);
    expect(buildSchedule(loan({ ...start, principal: 200_000, annualRate: 5, termMonths: 360 })).regularPayment).toBe(1073.64);
  });

  it('quotes the payment at the rate in force on the start day', () => {
    const quoted = fromMinor(annuityPayment(toMinor(10_000), 6, 12));
    for (const from of ['2025-06-01', loan().startDate]) {
      const schedule = buildSchedule(loan({ rateChanges: [{ from, annualRate: 6 }] }));
      expect(schedule.regularPayment).toBe(quoted);
      expect(schedule.rows[0].payment).toBe(quoted);
    }
  });

  it('repays an actual/365 annuity in level payments, the last within cents of rounding', () => {
    for (const annualRate of [5, 10, 16, 20]) {
      for (const startDate of ['2026-01-01', '2026-01-20']) {
        const input = loan({
          principal: 300_000,
          termMonths: 360,
          annualRate,
          dayCount: 'actual/365',
          startDate,
          paymentDay: 1,
        });
        const schedule = buildSchedule(input);
        const label = { annualRate, startDate };
        const last = schedule.rows[schedule.rows.length - 1];
        // A cent a period at most, carried with interest to the end.
        const bound = carriedFactor(annualRate, Array(360).fill(1 / 12)) / 100;
        expect({ ...label, periods: schedule.periods }).toEqual({ ...label, periods: 360 });
        expect({
          ...label,
          level: schedule.rows.slice(1, -1).every(row => row.payment === schedule.regularPayment),
        }).toEqual({ ...label, level: true });
        expect({ ...label, residue: Math.abs(last.payment - schedule.regularPayment) <= bound }).toEqual(
          { ...label, residue: true },
        );
        expect(repaid(schedule.rows)).toBe(toMinor(300_000));
      }
    }
  });

  describe('a broken first period', () => {
    const banked = (terms: Partial<LoanPlanInput>) => {
      const schedule = buildSchedule(loan(terms));
      const dates = paymentDates(loan(terms));
      const last = schedule.rows[schedule.rows.length - 1];
      expect(schedule.periods).toBe(loan(terms).termMonths);
      expect(schedule.payoffDate).toBe(dates[dates.length - 1]);
      expect(new Set(schedule.rows.slice(1, -1).map(row => row.payment))).toEqual(
        new Set([schedule.regularPayment]),
      );
      // The balance never rises: every payment repays some of it.
      expect(schedule.rows.every(row => row.principal > 0)).toBe(true);
      expect(Math.abs(last.payment - schedule.regularPayment)).toBeLessThan(5);
      expect(last.balance).toBe(0);
      expect(repaid(schedule.rows)).toBe(toMinor(loan(terms).principal));
      return schedule;
    };
    const mortgage = { principal: 300_000, termMonths: 360, annualRate: 5 };

    it('quotes the whole-month payment and adds the extra days of a long first period to the first', () => {
      // 20 January to 1 March: 41 days of interest under 30/360, where a whole month has 30.
      const schedule = banked({ ...mortgage, startDate: '2026-01-20', paymentDay: 1 });
      expect(schedule.regularPayment).toBe(1610.46);
      expect(schedule.rows[0]).toMatchObject({
        date: '2026-03-01',
        interest: 1708.33,
        principal: 360.46,
        payment: 2068.79,
      });
    });

    it('takes the missing days of a short first period off the first payment', () => {
      // 28 January to 25 February: 27 days under 30/360.
      const schedule = banked({ ...mortgage, annualRate: 7.5, startDate: '2026-01-28', paymentDay: 25 });
      expect(schedule.regularPayment).toBe(2097.64);
      expect(schedule.rows[0]).toMatchObject({
        date: '2026-02-25',
        interest: 1687.5,
        principal: 222.64,
        payment: 1910.14,
      });
    });

    it('charges the first period its own days under either day count', () => {
      const terms = { ...mortgage, startDate: '2026-03-03', paymentDay: 31 };
      // 3 to 31 March: 27 days under 30/360, where a whole month charges 1,250.
      expect(banked(terms).rows[0]).toMatchObject({ interest: 1125, payment: 1485.46 });
      // 28 days of 365, where the whole month it stands in for (28 February to 31 March) has 31.
      const actual = banked({ ...terms, dayCount: 'actual/365' });
      expect(actual.rows[0].interest).toBe(1150.68);
      expect(toMinor(actual.rows[0].payment)).toBe(
        toMinor(actual.regularPayment) - toMinor(1273.97) + toMinor(1150.68),
      );
    });

    it('lowers the payment from the start for an extra paid on the start day', () => {
      const terms = { ...mortgage, startDate: '2026-01-28', paymentDay: 25, extraMode: 'reduce_payment' as const };
      const smaller = buildSchedule(loan({ ...terms, principal: 290_000 }));
      const paidDown = buildSchedule(loan({ ...terms, extraPayments: [{ date: '2026-01-28', amount: 10_000 }] }));
      expect(paidDown.rows[0].extra).toBe(10_000);
      expect(paidDown.rows.slice(0, -1).map(row => row.payment)).toEqual(
        smaller.rows.slice(0, -1).map(row => row.payment),
      );
      expect(paidDown.periods).toBe(360);
    });
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

  it('never runs out before the term when a monthly part is not whole cents', () => {
    // 1,000 over 600 months is 1.666… a month: rounded up, 1.67 would repay it in 599.
    for (const method of ['linear', 'annuity'] as const) {
      const schedule = buildSchedule(loan({ method, principal: 1_000, termMonths: 600, annualRate: method === 'linear' ? 6 : 0 }));
      expect(schedule.periods).toBe(600);
      expect(schedule.rows.slice(0, -1).every(row => row.principal === 1.66)).toBe(true);
      expect(schedule.rows[599].principal).toBe(5.66);
      expect(repaid(schedule.rows)).toBe(toMinor(1_000));
    }
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
          // The cut term ends with the part of a payment it needs, never more than one.
          expect(last.payment).toBeLessThanOrEqual(schedule.rows[schedule.rows.length - 2].payment + 0.01);
          expect(last.balance).toBe(0);
          expect(repaid(schedule.rows)).toBe(toMinor(principal));
        }
      }
    });
  });

  it('pays an extra payment dated on the start day before any interest', () => {
    const start = loan().startDate;
    const shorter = buildSchedule(loan({ extraPayments: [{ date: start, amount: 1_000 }] }));
    // A whole month on 9,000 instead of 10,000, the payment kept, the term shorter.
    expect(shorter.rows[0]).toMatchObject({ interest: 90, extra: 1_000, payment: 888.49 });
    expect(shorter.periods).toBeLessThan(12);
    expect(repaid(shorter.rows)).toBe(toMinor(10_000));

    const lower = buildSchedule(
      loan({ extraPayments: [{ date: start, amount: 1_000 }], extraMode: 'reduce_payment' }),
    );
    expect(lower.periods).toBe(12);
    expect(lower.rows[0].payment).toBe(fromMinor(annuityPayment(toMinor(9_000), 12, 12)));
    expect(repaid(lower.rows)).toBe(toMinor(10_000));
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

  it('keeps the regular payment, not the first one, before a broken first period ends', () => {
    // 20 January to 1 March: the first payment carries 41 days of interest under 30/360.
    const broken = loan({ principal: 12_000, startDate: '2026-01-20', paymentDay: 1 });
    const planned = buildSchedule(broken);
    const onPlan = projectSchedule(broken, '2026-02-01', 12_000);
    expect(onPlan?.rows.map(row => row.payment)).toEqual(planned.rows.map(row => row.payment));
    expect(onPlan?.regularPayment).toBe(planned.regularPayment);
  });

  it('never counts again an extra payment already paid by today', () => {
    // Paid on 18 May, after the 15 May instalment: the real balance already has it.
    const paid = loan({ principal: 12_000, extraPayments: [{ date: '2026-05-18', amount: 2_000 }] });
    const owed = plan.rows[3].balance - 2_000;
    const projected = projectSchedule(paid, today, owed);
    expect(projected?.rows).toEqual(projectSchedule(terms, today, owed)?.rows);
    expect(projected?.rows.every(row => row.extra === 0)).toBe(true);
  });

  it('has nothing to project when paid off or past the last payment date', () => {
    expect(projectSchedule(terms, today, 0)).toBeNull();
    expect(projectSchedule(terms, '2027-02-01', 500)).toBeNull();
  });
});

describe('roundsWithinTerm', () => {
  it('accepts a plan that takes its whole term', () => {
    expect(roundsWithinTerm(loan({ principal: 300_000, annualRate: 5, termMonths: 360 }))).toBe(true);
    expect(buildSchedule(loan({ principal: 300_000, annualRate: 5, termMonths: 360 })).periods).toBe(360);
    // Extra payments end it early on purpose: the check leaves them out.
    const paidDown = loan({
      principal: 300_000,
      annualRate: 5,
      termMonths: 360,
      extraPayments: [{ date: '2027-01-15', amount: 50_000 }],
      recurringExtras: [{ from: '2027-02-15', amount: 200 }],
    });
    expect(buildSchedule(paidDown).periods).toBeLessThan(360);
    expect(roundsWithinTerm(paidDown)).toBe(true);
    // Linear parts round down and interest-free payments carry no interest: never early.
    expect(roundsWithinTerm(loan({ principal: 1_000, annualRate: 30, termMonths: 600, method: 'linear' }))).toBe(true);
  });

  it('refuses an annuity that cents of rounding end a period early', () => {
    const early = [
      { principal: 10_181.91, annualRate: 11.1412, termMonths: 557, startDate: '2026-06-24', paymentDay: 21 },
      { principal: 200.88, annualRate: 14.729, termMonths: 169, startDate: '2026-06-19', paymentDay: 24 },
      { principal: 145_863_085.55, annualRate: 49.8213, termMonths: 435, startDate: '2028-03-22', paymentDay: 24 },
    ];
    for (const terms of early) {
      expect({ terms, periods: buildSchedule(loan(terms)).periods }).toEqual({
        terms,
        periods: terms.termMonths - 1,
      });
      expect({ terms, fits: roundsWithinTerm(loan(terms)) }).toEqual({ terms, fits: false });
      // Extra payments end a loan early on purpose: they are left out of the check.
      expect(roundsWithinTerm(loan({ ...terms, extraPayments: [{ date: '2027-01-21', amount: 10 }] }))).toBe(false);
    }
  });

  it('checks the plan with its rate changes, not at the first rate alone', () => {
    const terms = loan({ principal: 95_128, annualRate: 4, termMonths: 588 });
    expect(roundsWithinTerm(terms)).toBe(true);
    const raised = { ...terms, rateChanges: [{ from: '2027-01-15', annualRate: 19.16 }] };
    expect(buildSchedule(raised).periods).toBe(587);
    expect(roundsWithinTerm(raised)).toBe(false);
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

  it('applies its mode to its own extra payments only, never to the saved ones', () => {
    const dates = paymentDates(loan());
    // The plan already shortens the term with 3,000; the what-if adds a cent to lower the payment.
    const saved = loan({ extraPayments: [{ date: dates[1], amount: 3_000 }] });
    const result = whatIf(saved, {
      extraPayments: [{ date: dates[6], amount: 0.01 }],
      recurringExtras: [],
      extraMode: 'reduce_payment',
    });
    expect(result.monthsSaved).toBe(0);
    expect(result.scenario.periods).toBe(result.baseline.periods);
    expect(result.interestSaved).toBeGreaterThanOrEqual(0);
    expect(result.interestSaved).toBeLessThan(0.05);
    expect(result.paymentBefore).toBe(888.49);
    expect(888.49 - (result.paymentAfter ?? 0)).toBeLessThan(0.05);

    // And the other way round: a payment-lowering plan, a term-shortening what-if.
    const lowered = loan({ extraPayments: [{ date: dates[1], amount: 3_000 }], extraMode: 'reduce_payment' });
    const shorter = whatIf(lowered, {
      extraPayments: [{ date: dates[6], amount: 1_500 }],
      recurringExtras: [],
      extraMode: 'reduce_term',
    });
    expect(shorter.baseline.periods).toBe(12);
    expect(shorter.monthsSaved).toBeGreaterThan(0);
    expect(shorter.interestSaved).toBeGreaterThan(0);
  });

  it("names the payment after the what-if's own first extra payment, not a saved one", () => {
    const dates = paymentDates(loan());
    const saved = loan({ extraPayments: [{ date: dates[1], amount: 2_000 }], extraMode: 'reduce_payment' });
    const baseline = buildSchedule(saved);
    const result = whatIf(saved, {
      extraPayments: [{ date: dates[5], amount: 1_000 }],
      recurringExtras: [],
      extraMode: 'reduce_payment',
    });
    expect(result.paymentBefore).toBe(baseline.rows[6].payment);
    expect(result.paymentAfter).toBeLessThan(baseline.rows[6].payment);
  });

  it('saves nothing without extra payments', () => {
    const result = whatIf(loan(), { extraPayments: [], recurringExtras: [], extraMode: 'reduce_term' });
    expect(result).toMatchObject({ monthsSaved: 0, interestSaved: 0, paymentAfter: null });
  });
});
