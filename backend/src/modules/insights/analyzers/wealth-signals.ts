/**
 * The arithmetic behind three insights — idle cash, a net worth milestone and
 * an unusual category — kept free of queries so every threshold can be tested
 * on the odd shapes real households produce. Every threshold is relative: to
 * the household's own spending, or to the category's own history. None is an
 * amount in some currency, so a JPY workspace and a EUR one are judged alike.
 */

/** Everyday money beyond this many months of spending is resting without a task. */
export const IDLE_CASH_MONTHS = 6;
/** Fewer full months of spending than this and an average says little. */
export const MIN_SPENDING_MONTHS = 3;

/** A category needs this many full months of history to have a "usual". */
export const ANOMALY_MIN_BASELINE_MONTHS = 4;
/** ...and spending in at least this many of them: an occasional one has no usual. */
export const ANOMALY_MIN_ACTIVE_MONTHS = 3;
/** At least this many times the category's median month. */
export const ANOMALY_MIN_RATIO = 1.5;
/** At least this many robust deviations (MAD) above the median. */
export const ANOMALY_MIN_DEVIATIONS = 3.5;
/**
 * The deviation is never read as narrower than this share of the median: a
 * fixed bill has a MAD of zero, and a few percent more would otherwise be
 * infinitely unusual.
 */
export const ANOMALY_MIN_SPREAD_SHARE = 0.1;
/** The excess has to matter to the household: this share of its median month. */
export const ANOMALY_HOUSEHOLD_SHARE = 0.03;
/** MAD times this estimates a standard deviation for normally spread data. */
const MAD_TO_SIGMA = 1.4826;

export function median(values: readonly number[]): number {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

/**
 * How many months of spending the everyday accounts hold, when that is more
 * than `IDLE_CASH_MONTHS`; null otherwise, and null when there is no spending
 * history to measure by (a young workspace, or one that spends nothing).
 */
export function idleCashMonths(input: {
  cash: number;
  monthlySpending: number;
  monthsObserved: number;
}): number | null {
  const { cash, monthlySpending, monthsObserved } = input;
  if (monthsObserved < MIN_SPENDING_MONTHS || !(monthlySpending > 0)) {
    return null;
  }
  const months = cash / monthlySpending;
  return months >= IDLE_CASH_MONTHS ? Math.floor(months) : null;
}

/** 1, 2, 5, 10, 20, 50… scaled to whatever the currency's numbers look like. */
const LADDER = [1, 2, 5] as const;

/** The highest 1-2-5 round number at or below `value`; null below one unit. */
export function milestoneAtOrBelow(value: number): number | null {
  if (!Number.isFinite(value) || value < 1) {
    return null;
  }
  let magnitude = 1;
  while (magnitude * 10 <= value) {
    magnitude *= 10;
  }
  const steps = LADDER.map(step => step * magnitude).filter(step => step <= value);
  return steps[steps.length - 1];
}

/** The round number before `milestone` on the ladder: 100 000 → 50 000 → 20 000. */
export function stepBelow(milestone: number): number {
  let magnitude = 1;
  while (magnitude * 10 <= milestone) {
    magnitude *= 10;
  }
  const mantissa = Math.round(milestone / magnitude);
  return mantissa === 1 ? magnitude / 2 : mantissa === 2 ? magnitude : 2 * magnitude;
}

export interface NetWorthPointLike {
  date: string;
  value: number;
}

/**
 * The round number net worth crossed upward within `recent`, or null.
 *
 * Fires only when the highest value before the window was below the milestone
 * but already in the band just below it (crossing 100 000 needs a peak of at
 * least 50 000 before). That keeps two things out: a dip and a recovery (the
 * old peak was already past the line, so a wobble never announces it twice),
 * and a jump from nothing, which is a balance being typed in, not progress.
 * Milestones under one month of the household's spending are not milestones.
 */
export function crossedMilestone(input: {
  recent: readonly NetWorthPointLike[];
  peakBefore: number;
  floor: number;
}): { milestone: number; date: string } | null {
  const { recent, peakBefore, floor } = input;
  if (recent.length === 0 || !(floor > 0)) {
    return null;
  }
  const milestone = milestoneAtOrBelow(Math.max(...recent.map(point => point.value)));
  if (milestone === null || milestone < floor) {
    return null;
  }
  if (peakBefore >= milestone || peakBefore < stepBelow(milestone)) {
    return null;
  }
  const crossing = recent.find(point => point.value >= milestone);
  return crossing ? { milestone, date: crossing.date } : null;
}

export interface CategoryHistory {
  categoryId: string;
  categoryName: string;
  /** Spent in the current period so far. */
  current: number;
  /** One total per full month of the baseline, zeros included. */
  baseline: readonly number[];
}

export interface CategoryAnomaly {
  categoryId: string;
  categoryName: string;
  current: number;
  usual: number;
  ratio: number;
  months: number;
}

/**
 * Every category well above its own median month, the largest excess first.
 * A category is unusual when it is well above its median both in proportion
 * and in robust deviations, and the excess is a real share of what the
 * household spends in a month. The median and MAD shrug off one huge month in
 * the history, which an average would carry for half a year. All of them, not
 * only the largest: each is its own fact, and naming only the top one would
 * retire a card and announce it again whenever two swap places.
 */
export function findCategoryAnomalies(input: {
  categories: readonly CategoryHistory[];
  household: readonly number[];
}): CategoryAnomaly[] {
  if (input.household.length < ANOMALY_MIN_BASELINE_MONTHS) {
    return [];
  }
  const floor = median(input.household) * ANOMALY_HOUSEHOLD_SHARE;
  if (!(floor > 0)) {
    return [];
  }

  const anomalies = input.categories.flatMap(category => {
    const active = category.baseline.filter(value => value > 0).length;
    const usual = median(category.baseline);
    if (active < ANOMALY_MIN_ACTIVE_MONTHS || !(usual > 0)) {
      return [];
    }
    const mad = median(category.baseline.map(value => Math.abs(value - usual)));
    const spread = Math.max(mad * MAD_TO_SIGMA, usual * ANOMALY_MIN_SPREAD_SHARE);
    const excess = category.current - usual;
    const unusual =
      category.current >= usual * ANOMALY_MIN_RATIO &&
      excess / spread >= ANOMALY_MIN_DEVIATIONS &&
      excess >= floor;
    return unusual ? [{ category, usual, excess }] : [];
  });

  return anomalies
    .sort((a, b) => b.excess - a.excess)
    .map(({ category, usual }) => ({
      categoryId: category.categoryId,
      categoryName: category.categoryName,
      current: category.current,
      usual,
      ratio: category.current / usual,
      months: category.baseline.length,
    }));
}
