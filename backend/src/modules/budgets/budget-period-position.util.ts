import type { Budget } from '../../entities/budget.entity';
import { clampToWindow, computePeriodRange, localDay, overlapsWindow } from './budget-period.util';

/** Where a day stands for a budget: inside its window or not, and the period it is measured in. */
export interface PeriodPosition {
  /** Whether the day falls inside the budget's window. Always true for open-ended ones. */
  isActive: boolean;
  /**
   * First and last day (`YYYY-MM-DD`) of the period the figures cover, cut to
   * the budget's window; null when the window misses the period entirely.
   * The client counts the days left from these instead of assuming a calendar
   * month, so a weekly budget or one that ends mid-month divides by its own days.
   */
  periodStart: string | null;
  periodEnd: string | null;
}

export function periodPosition(
  budget: Pick<Budget, 'periodType' | 'startsOn' | 'endsOn'>,
  now: Date,
): PeriodPosition {
  const period = clampToWindow(computePeriodRange(budget.periodType, now), budget);
  return {
    isActive: overlapsWindow({ start: now, end: now }, budget),
    periodStart: period ? localDay(period.start) : null,
    periodEnd: period ? localDay(period.end) : null,
  };
}
