import type { DashboardCommitmentItem } from '@/contracts';
import {
  addDays,
  detectRecurringIncome,
  type ForecastEvent,
} from '@/modules/forecast/forecast.engine';
import { toPlanCommitments } from '@/modules/forecast/paycheck-commitments';
import {
  type PlanCommitment,
  type PlanPayday,
  periodsFromPaydays,
  planPeriods,
} from '@/modules/forecast/paycheck-planner';
import { projectPaydays, scheduleOf } from '@/modules/forecast/paycheck-schedule';
import { assembleStreams, chooseStreams } from '@/modules/forecast/paycheck-streams';

const PAYER = 'ACME Payroll';
const CLIENT = 'Example Client';

const incomeRows = (dates: string[], amount = 3000, payer = PAYER) =>
  dates.map(transactionDate => ({ counterpartyName: payer, amount, transactionDate }));

/** Detected payer and its projected paydays, the way the service builds them. */
function project(dates: string[], today: string, horizonEnd = '2027-06-30') {
  const [income] = detectRecurringIncome(incomeRows(dates), today);
  const schedule = scheduleOf(income, dates);
  return { income, schedule, paydays: projectPaydays(schedule, income.lastDate, today, horizonEnd) };
}

const payday = (date: string, amount: number, extra: Partial<PlanPayday> = {}): PlanPayday => ({
  date,
  amount,
  label: PAYER,
  streamId: 'detected:x',
  sourceId: `pay:${date}`,
  isLate: false,
  ...extra,
});

const bill = (date: string, amount: number, extra: Partial<PlanCommitment> = {}): PlanCommitment => ({
  date,
  label: 'ACME Rent',
  amount,
  kind: 'payable',
  sourceId: `bill:${date}`,
  isOverdue: false,
  ...extra,
});

describe('paycheck schedule', () => {
  it('keeps both days of a payer paying twice a month, Fridays for weekend days', () => {
    // The 10th and the 25th; October's fell on a weekend and came on the Friday.
    const history = ['2026-08-10', '2026-08-25', '2026-09-10', '2026-09-25', '2026-10-09', '2026-10-23'];
    const { schedule, paydays } = project(history, '2026-11-02');

    expect(schedule).toMatchObject({ cadence: 'semimonthly', daysOfMonth: [10, 25] });
    expect(paydays.slice(0, 6).map(day => day.date)).toEqual([
      '2026-11-10',
      '2026-11-25',
      '2026-12-10',
      '2026-12-25',
      '2027-01-08', // the 10th is a Sunday
      '2027-01-25',
    ]);
    const periods = periodsFromPaydays(
      '2026-11-02',
      '2026-10-23',
      paydays.map(day => day.date),
      4,
    );
    expect(periods).toEqual([
      { start: '2026-10-23', end: '2026-11-09', nextPayday: '2026-11-10' },
      { start: '2026-11-10', end: '2026-11-24', nextPayday: '2026-11-25' },
      { start: '2026-11-25', end: '2026-12-09', nextPayday: '2026-12-10' },
      { start: '2026-12-10', end: '2026-12-24', nextPayday: '2026-12-25' },
    ]);
  });

  it('pays a monthly payer on its usual day, moved back to the Friday from a weekend', () => {
    // The 15th; August's was a Saturday and came on Friday the 14th.
    const history = ['2026-07-15', '2026-08-14', '2026-09-15', '2026-10-15'];
    const { schedule, paydays } = project(history, '2026-11-09');

    expect(schedule).toMatchObject({ cadence: 'monthly', daysOfMonth: [15], paysOnWeekends: false });
    expect(paydays.slice(0, 3).map(day => day.date)).toEqual([
      '2026-11-13', // the 15th is a Sunday
      '2026-12-15',
      '2027-01-15',
    ]);
  });

  it('reads a payer every two weeks as fortnightly even over a short history', () => {
    // Every other Friday; the days of the month pair up into two clusters.
    const everyTwoWeeks = (count: number) =>
      Array.from({ length: count }, (_, index) => addDays('2026-11-06', -14 * (count - 1 - index)));
    for (const count of [3, 5, 6, 8]) {
      const history = everyTwoWeeks(count);
      const { schedule, paydays } = project(history, '2026-11-09');
      expect({ count, ...schedule }).toMatchObject({ count, cadence: 'fortnightly', daysOfMonth: [] });
      expect(paydays.slice(0, 3).map(day => day.date)).toEqual(['2026-11-20', '2026-12-04', '2026-12-18']);
    }
    const { paydays } = project(['2026-10-02', '2026-10-16', '2026-10-30'], '2026-11-09');
    expect(paydays[0].date).toBe('2026-11-13');
  });

  it('reads a monthly payer on the 1st as the 1st when weekend paydays came the day before', () => {
    // Aug 1 was a Saturday and Nov 1 a Sunday: both came on the Friday before.
    const history = ['2026-07-31', '2026-09-01', '2026-10-01', '2026-10-30'];
    const { schedule, paydays } = project(history, '2026-11-09');
    expect(schedule).toMatchObject({ cadence: 'monthly', daysOfMonth: [1] });
    expect(paydays.slice(0, 2).map(day => day.date)).toEqual(['2026-12-01', '2027-01-01']);
  });

  it('keeps a weekend payday when the payer has booked on weekends before', () => {
    const history = ['2026-07-15', '2026-08-15', '2026-09-15', '2026-10-15'];
    const { schedule, paydays } = project(history, '2026-11-09');

    expect(schedule.paysOnWeekends).toBe(true);
    expect(paydays[0].date).toBe('2026-11-15');
  });

  it('keeps a weekly payer on its interval and gives week-long periods', () => {
    const history = ['2026-10-16', '2026-10-23', '2026-10-30', '2026-11-06'];
    const { schedule, paydays } = project(history, '2026-11-09');

    expect(schedule.cadence).toBe('weekly');
    const periods = periodsFromPaydays('2026-11-09', '2026-11-06', paydays.map(day => day.date), 4);
    expect(periods.map(period => [period.start, period.end])).toEqual([
      ['2026-11-06', '2026-11-12'],
      ['2026-11-13', '2026-11-19'],
      ['2026-11-20', '2026-11-26'],
      ['2026-11-27', '2026-12-03'],
    ]);
  });

  it('expects a payday a few days late today, and starts the period there', () => {
    // Paid on the 1st; November's has not come in two days later.
    const history = ['2026-07-01', '2026-08-01', '2026-09-01', '2026-10-01'];
    const { paydays } = project(history, '2026-11-03');

    expect(paydays.slice(0, 2)).toEqual([
      { date: '2026-11-03', isLate: true },
      { date: '2026-12-01', isLate: false },
    ]);
    const periods = periodsFromPaydays('2026-11-03', '2026-10-01', paydays.map(day => day.date), 1);
    expect(periods).toEqual([{ start: '2026-11-03', end: '2026-11-30', nextPayday: '2026-12-01' }]);
  });

  it('has no periods without a payday ahead', () => {
    expect(periodsFromPaydays('2026-11-09', null, [], 4)).toEqual([]);
    expect(chooseStreams([], undefined)).toEqual(new Set());
  });

  it('starts one period, not two, for paydays of two payers a day apart', () => {
    const periods = periodsFromPaydays(
      '2026-11-09',
      null,
      ['2026-11-25', '2026-11-26', '2026-12-25'],
      2,
    );
    expect(periods).toEqual([
      { start: '2026-11-09', end: '2026-11-24', nextPayday: '2026-11-25' },
      { start: '2026-11-25', end: '2026-12-24', nextPayday: '2026-12-25' },
    ]);
  });
});

describe('planPeriods', () => {
  const periods = [
    { start: '2026-10-25', end: '2026-11-24', nextPayday: '2026-11-25' },
    { start: '2026-11-25', end: '2026-12-24', nextPayday: '2026-12-25' },
  ];

  it('is cash + income − commitments − buffer, per period and per day left', () => {
    const [current] = planPeriods({
      today: '2026-11-15',
      cash: 1000,
      buffer: 100,
      periods,
      paydays: [],
      commitments: [bill('2026-11-20', 200), bill('2026-11-10', 999)],
    });

    // The bill before today is not in the plan (an overdue one comes dated today).
    expect(current).toMatchObject({
      daysLeft: 10,
      startingCash: 1000,
      startingCashProjected: false,
      income: 0,
      commitments: 200,
      safeToSpend: 700,
      safeToSpendPerDay: 70,
    });
  });

  it('pays a bill due on payday from that payday, in the next period', () => {
    const [current, next] = planPeriods({
      today: '2026-11-15',
      cash: 300,
      buffer: 0,
      periods,
      paydays: [payday('2026-11-25', 3000)],
      commitments: [bill('2026-11-25', 1200)],
    });

    expect(current.items).toEqual([]);
    expect(current.safeToSpend).toBe(300);
    // Spent what was safe, so the next period starts from nothing, and the
    // bill on payday does not take it below zero: the pay arrives first.
    expect(next).toMatchObject({ startingCash: 0, startingCashProjected: true, safeToSpend: 1800 });
    expect(next.items.map(item => item.kind)).toEqual(['income', 'payable']);
  });

  it('carries the buffer and a shortfall into the projected cash of the next period', () => {
    const [current, next] = planPeriods({
      today: '2026-11-15',
      cash: 1000,
      buffer: 100,
      periods,
      paydays: [payday('2026-11-25', 2000)],
      commitments: [bill('2026-11-20', 200), bill('2026-12-01', 500)],
    });
    expect(current.safeToSpend).toBe(700);
    expect(next).toMatchObject({ startingCash: 100, income: 2000, commitments: 500, safeToSpend: 1500 });

    const [short, after] = planPeriods({
      today: '2026-11-15',
      cash: 100,
      buffer: 0,
      periods,
      paydays: [payday('2026-11-25', 2000)],
      commitments: [bill('2026-11-20', 400)],
    });
    expect(short).toMatchObject({ safeToSpend: -300, safeToSpendPerDay: 0 });
    expect(after.startingCash).toBe(-300);
  });

  it('reads safe to spend at the lowest point when a bill comes before the money', () => {
    const [current] = planPeriods({
      today: '2026-11-15',
      cash: 100,
      buffer: 0,
      periods,
      paydays: [payday('2026-11-22', 1000, { streamId: null, label: CLIENT })],
      commitments: [bill('2026-11-17', 300)],
    });
    expect(current).toMatchObject({ income: 1000, commitments: 300, safeToSpend: -200 });
  });
});

describe('assembleStreams', () => {
  const history = ['2026-07-15', '2026-08-14', '2026-09-15', '2026-10-15'];
  const detected = () => {
    const [income] = detectRecurringIncome(incomeRows(history), '2026-11-09');
    return [{ income, paydays: history }];
  };
  const receivable = (date: string, amount: number, label: string, id: string): ForecastEvent => ({
    date,
    amount,
    label,
    kind: 'invoice',
    sourceId: id,
  });

  it('lets a declared payday stand for the projected one, never both', () => {
    const { streams, extras } = assembleStreams(
      detected(),
      [
        receivable('2026-11-14', 3100, PAYER, 'rec-1'),
        receivable('2026-11-28', 500, PAYER, 'rec-bonus'),
        receivable('2026-11-20', 800, CLIENT, 'rec-2'),
        receivable('2026-12-20', 800, CLIENT, 'rec-3'),
      ],
      '2026-11-09',
      '2027-03-31',
    );

    const [salary, client] = streams;
    expect(salary.stream).toMatchObject({ kind: 'detected', cadence: 'monthly', nextDate: '2026-11-14' });
    expect(salary.paydays.filter(day => day.date.startsWith('2026-11'))).toEqual([
      expect.objectContaining({ date: '2026-11-14', amount: 3100, sourceId: 'rec-1' }),
    ]);
    expect(extras).toEqual([expect.objectContaining({ sourceId: 'rec-bonus', streamId: null })]);
    expect(client.stream).toMatchObject({ kind: 'declared', label: CLIENT, nextDate: '2026-11-20' });
    expect(client.paydays.map(day => day.sourceId)).toEqual(['rec-2', 'rec-3']);

    // By default the detected salary starts the periods; asked for, the client does.
    expect(chooseStreams(streams, undefined)).toEqual(new Set([salary.stream.id]));
    expect(chooseStreams(streams, [client.stream.id, 'detected:unknown'])).toEqual(
      new Set([client.stream.id]),
    );
  });

  it('starts periods from a repeating declared payer when no payer is detected', () => {
    const { streams } = assembleStreams(
      [],
      [
        receivable('2026-11-20', 800, CLIENT, 'rec-2'),
        receivable('2026-12-20', 800, CLIENT, 'rec-3'),
        receivable('2026-11-30', 90, 'One-off Buyer', 'rec-4'),
      ],
      '2026-11-09',
      '2027-03-31',
    );
    const chosen = chooseStreams(streams, undefined);
    expect([...chosen]).toEqual([streams[0].stream.id]);
    expect(streams[0].stream.label).toBe(CLIENT);
  });

  it('gives payer ids no comma, so a list of them survives the query string', () => {
    const [income] = detectRecurringIncome(incomeRows(history, 3000, 'ACME, Inc.'), '2026-11-09');
    const { streams } = assembleStreams([{ income, paydays: history }], [], '2026-11-09', '2027-01-31');
    expect(streams[0].stream.id).toMatch(/^detected:[0-9a-z]+$/);
  });
});

describe('toPlanCommitments', () => {
  const charge = (date: string, sourceId = 'sub-1'): DashboardCommitmentItem => ({
    date,
    label: 'ACME Streaming',
    amount: 12,
    source: 'subscription',
    sourceId,
    isOverdue: false,
  });

  it('drops a subscription charge paid early, and keeps the ones after it', () => {
    const items = toPlanCommitments(
      [charge('2026-11-20'), charge('2026-12-20'), charge('2026-11-25', 'sub-2')],
      new Map([
        // October's charge paid on time, November's on the 12th: early.
        ['sub-1', { paymentDates: ['2026-11-12', '2026-10-20'], frequency: 'monthly' }],
        // Paid a month before: the 25th is still due.
        ['sub-2', { paymentDates: ['2026-10-25'], frequency: 'monthly' }],
      ]),
      '2026-11-15',
    );
    expect(items.map(item => [item.sourceId, item.date])).toEqual([
      ['sub-2', '2026-11-25'],
      ['sub-1', '2026-12-20'],
    ]);
  });

  it('keeps the next charge when the payment before it was the previous charge paid late', () => {
    // The October 25 charge paid on November 12; the one before on September 25.
    const late = { paymentDates: ['2026-11-12', '2026-09-25'], frequency: 'monthly' };
    const items = toPlanCommitments([charge('2026-11-25')], new Map([['sub-1', late]]), '2026-11-15');
    expect(items.map(item => item.date)).toEqual(['2026-11-25']);
    // A single payment with nothing before it is not taken for the next charge either.
    const only = { paymentDates: ['2026-11-12'], frequency: 'monthly' };
    expect(toPlanCommitments([charge('2026-11-25')], new Map([['sub-1', only]]), '2026-11-15')).toHaveLength(1);
  });
});
