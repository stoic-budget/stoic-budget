import { InsightType } from '../../../entities/insight.entity';
import type { StoicSignal } from './stoic-signals';

export interface StoicGoalView {
  id: string;
  name: string;
  percent: number;
  status: 'reached' | 'no_deadline' | 'on_track' | 'tight' | 'not_feasible';
  requiredPerMonth: number | null;
  pacePerMonth: number;
  monthsLate: number | null;
  freePerMonth: number;
}

/** What lies ahead, from the same forecast the Forecast page draws. */
export interface StoicOutlook {
  shortfallDate: string | null;
  lowestBalance: number;
  /** The money to fall back on today, savings and deposits included. */
  reserve: number;
}

const pct = (value: number) => Math.round(value);
const money = (value: number) => Math.round(value);

export function goalSignals(goals: StoicGoalView[]): StoicSignal[] {
  return [...datedGoalSignals(goals), ...undatedGoalSignals(goals)];
}

function datedGoalSignals(goals: StoicGoalView[]): StoicSignal[] {
  const notFeasible = goals.find(goal => goal.status === 'not_feasible');
  if (notFeasible && notFeasible.requiredPerMonth !== null) {
    return [
      {
        key: 'stoic.goal_not_feasible',
        type: InsightType.STOIC_GOAL,
        priority: 85,
        params: {
          goal: notFeasible.name,
          requiredAmount: money(notFeasible.requiredPerMonth),
          freeAmount: money(notFeasible.freePerMonth),
        },
        data: { goalId: notFeasible.id },
        subject: notFeasible.id,
      },
    ];
  }

  const behind = goals
    .filter(goal => (goal.monthsLate ?? 0) > 0 && goal.requiredPerMonth !== null)
    .sort((a, b) => (b.monthsLate ?? 0) - (a.monthsLate ?? 0))[0];
  if (behind) {
    return [
      {
        key: 'stoic.goal_behind',
        type: InsightType.STOIC_GOAL,
        priority: 50,
        params: {
          goal: behind.name,
          requiredAmount: money(behind.requiredPerMonth ?? 0),
          paceAmount: money(behind.pacePerMonth),
          monthsLate: behind.monthsLate ?? 0,
        },
        data: { goalId: behind.id },
        subject: behind.id,
      },
    ];
  }

  const onTrack = goals
    .filter(goal => goal.status === 'on_track')
    .sort((a, b) => b.percent - a.percent)[0];
  return onTrack
    ? [
        {
          key: 'stoic.praise_goal_on_track',
          type: InsightType.STOIC_PRAISE,
          priority: 0,
          praise: true,
          params: { goal: onTrack.name, percent: pct(onTrack.percent) },
          data: { goalId: onTrack.id },
        },
      ]
    : [];
}

/** A goal with no date that nothing goes into: furthest along first, it is closest to real. */
function undatedGoalSignals(goals: StoicGoalView[]): StoicSignal[] {
  const stalled = goals
    .filter(goal => goal.status === 'no_deadline' && goal.pacePerMonth <= 0)
    .sort((a, b) => b.percent - a.percent)[0];
  return stalled
    ? [
        {
          key: 'stoic.goal_no_date',
          type: InsightType.STOIC_GOAL,
          priority: 18,
          params: { goal: stalled.name, percent: pct(stalled.percent) },
          data: { goalId: stalled.id },
          subject: stalled.id,
        },
      ]
    : [];
}

export function shortfallSignals(outlook: StoicOutlook | null): StoicSignal[] {
  if (!outlook?.shortfallDate) {
    return [];
  }
  return [
    {
      key: 'stoic.shortfall',
      type: InsightType.STOIC_COMMITMENTS,
      priority: 100,
      params: { date: outlook.shortfallDate, lowestAmount: money(outlook.lowestBalance) },
    },
  ];
}
