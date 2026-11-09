import { describe, expect, it } from 'vitest';
import type { LoanSchedule } from '@/app/lib/contracts';
import { currentPage, ROWS_PER_PAGE } from './LoanScheduleTable';
import { loanChartPoints } from './loan-chart-points';

const row = (period: number, date: string, balance: number, actualBalance: number | null) => ({
  period,
  date,
  annualRate: 5,
  payment: 100,
  interest: 10,
  principal: 90,
  extra: 0,
  balance,
  actualBalance,
});

const projected = (period: number, date: string, balance: number) => {
  const { actualBalance: _none, ...rest } = row(period, date, balance, null);
  return rest;
};

const monthly = (index: number) => {
  const month = index % 12;
  return `${2026 + Math.floor(index / 12)}-${String(month + 1).padStart(2, '0')}-10`;
};

const summary = { periods: 3, payoffDate: '2026-04-10', totalInterest: 30, totalPaid: 300, regularPayment: 100 };

const schedule = (patch: Partial<LoanSchedule> = {}): LoanSchedule => ({
  currency: 'EUR',
  startDate: '2026-01-10',
  principal: 270,
  today: '2026-02-20',
  plan: {
    ...summary,
    rows: [
      row(1, '2026-02-10', 180, 175),
      row(2, '2026-03-10', 90, null),
      row(3, '2026-04-10', 0, null),
    ],
  },
  actual: { balance: 175, plannedBalance: 180, difference: -5 },
  projection: {
    ...summary,
    periods: 2,
    from: '2026-02-10',
    startBalance: 175,
    rows: [projected(1, '2026-03-10', 86), projected(2, '2026-04-10', 0)],
  },
  ...patch,
});

describe('loanChartPoints', () => {
  it('lays plan, actual and forecast on one date line, the forecast continuing from today', () => {
    expect(loanChartPoints(schedule())).toEqual([
      { date: '2026-01-10', planned: 270, actual: null, projected: null },
      { date: '2026-02-10', planned: 180, actual: 175, projected: null },
      { date: '2026-02-20', planned: 180, actual: 175, projected: 175 },
      { date: '2026-03-10', planned: 90, actual: null, projected: 86 },
      { date: '2026-04-10', planned: 0, actual: null, projected: 0 },
    ]);
  });

  it('shows only the plan when there is nothing real to compare', () => {
    // The server leaves every actual balance out when the account has nothing to compare.
    const base = schedule();
    const rows = base.plan.rows.map(item => ({ ...item, actualBalance: null }));
    const points = loanChartPoints(
      schedule({ actual: null, projection: null, plan: { ...base.plan, rows } }),
    );
    expect(points.every(point => point.actual === null && point.projected === null)).toBe(true);
    expect(points).toHaveLength(4);
  });
});

describe('currentPage', () => {
  it('opens the schedule on the year of the next payment', () => {
    const rows = Array.from({ length: 36 }, (_, index) => row(index + 1, monthly(index), 0, null));
    const today = rows[ROWS_PER_PAGE + 2].date;
    expect(currentPage(schedule({ today, plan: { ...summary, rows } }))).toBe(1);
    expect(currentPage(schedule({ today: '2099-01-01', plan: { ...summary, rows } }))).toBe(2);
  });
});
