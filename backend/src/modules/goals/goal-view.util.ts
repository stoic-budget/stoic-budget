import type { GoalAccount } from '../../contracts';
import type { Goal, GoalContribution } from '../../entities';
import { round2, toNumber } from './goal-money.util';
import type { GoalProgress } from './goal-progress.service';
import type { LinkedTransaction } from './goal-transaction-link.service';

export interface GoalWithProgress {
  id: string;
  name: string;
  targetAmount: number;
  currency: string;
  targetDate: string | null;
  currentAmount: number;
  remaining: number;
  percent: number;
  isReached: boolean;
  createdAt: Date;
  cover: GoalCover | null;
  account: GoalAccount | null;
  /** Only set when the list was asked for one month: what was put aside in it. */
  contributedInMonth?: number;
}

/**
 * How the client should draw the goal's picture. `preset` is a bundled tile it
 * draws itself; `photo` carries the URL of the stored file, served as a static
 * upload. The credit line travels with it because a CC image may not be shown
 * without one.
 */
export type GoalCover =
  | { kind: 'preset'; preset: string }
  | { kind: 'photo'; url: string; attribution: string | null; sourceUrl: string | null };

export interface GoalDetail extends GoalWithProgress {
  contributions: Array<{
    id: string;
    amount: number;
    contributionDate: string;
    note: string | null;
    createdAt: Date;
    transaction: LinkedTransaction | null;
  }>;
}

const NO_PROGRESS: GoalProgress = { amount: 0, account: null, since: null };

export function toProgress(goal: Goal, progress: GoalProgress = NO_PROGRESS): GoalWithProgress {
  const targetAmount = toNumber(goal.targetAmount);
  const current = round2(progress.amount);

  return {
    id: goal.id,
    name: goal.name,
    targetAmount,
    currency: goal.currency,
    targetDate: goal.targetDate,
    currentAmount: current,
    // A goal can be overshot; what is left to save is never negative.
    remaining: round2(Math.max(targetAmount - current, 0)),
    percent: targetAmount > 0 ? round2((current / targetAmount) * 100) : 0,
    isReached: current >= targetAmount,
    createdAt: goal.createdAt,
    cover: toCover(goal),
    account: progress.account,
  };
}

function toCover(goal: Goal): GoalCover | null {
  if (goal.coverPreset) {
    return { kind: 'preset', preset: goal.coverPreset };
  }
  if (goal.coverFile) {
    // Served statically, like user avatars: the name is a fresh uuid and only
    // ever reaches a client that was allowed to read this goal.
    return {
      kind: 'photo',
      url: `/uploads/goal-covers/${goal.coverFile}`,
      attribution: goal.coverAttribution,
      sourceUrl: goal.coverSourceUrl,
    };
  }
  return null;
}

export function goalSnapshot(goal: Goal) {
  return {
    name: goal.name,
    targetAmount: toNumber(goal.targetAmount),
    currency: goal.currency,
    targetDate: goal.targetDate ?? null,
    walletId: goal.walletId ?? null,
  };
}

export function contributionSnapshot(contribution: GoalContribution) {
  return {
    id: contribution.id,
    amount: toNumber(contribution.amount),
    contributionDate: contribution.contributionDate,
    note: contribution.note ?? null,
  };
}

/** Half-open upper bound for a `YYYY-MM` month, so no day of it is missed. */
export function firstDayOfNextMonth(month: string): string {
  const [year, index] = month.split('-').map(Number);
  return index === 12 ? `${year + 1}-01-01` : `${year}-${String(index + 1).padStart(2, '0')}-01`;
}

export function today(): string {
  return new Date().toISOString().split('T')[0];
}
