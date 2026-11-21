import type { LoanSchedule } from '@/app/lib/contracts';

export interface LoanChartPoint {
  date: string;
  planned: number | null;
  actual: number | null;
  projected: number | null;
}

/**
 * One point per day any of the three lines has a value: the plan from the
 * start, the real balance on each past payment date and today, and the
 * forecast from today's real balance. The forecast starts at today's real
 * balance, so it continues the actual line instead of floating beside it.
 */
export function loanChartPoints(schedule: LoanSchedule): LoanChartPoint[] {
  const points = new Map<string, LoanChartPoint>();
  const at = (date: string) => {
    const point = points.get(date) ?? { date, planned: null, actual: null, projected: null };
    points.set(date, point);
    return point;
  };

  at(schedule.startDate).planned = schedule.principal;
  for (const row of schedule.plan.rows) {
    const point = at(row.date);
    point.planned = row.balance;
    point.actual = row.actualBalance;
  }
  if (schedule.actual) {
    const today = at(schedule.today);
    today.actual = schedule.actual.balance;
    today.planned ??= schedule.actual.plannedBalance;
    if (schedule.projection) {
      today.projected = schedule.actual.balance;
    }
  }
  for (const row of schedule.projection?.rows ?? []) {
    at(row.date).projected = row.balance;
  }
  return [...points.values()].sort((a, b) => a.date.localeCompare(b.date));
}
