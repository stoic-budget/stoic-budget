import { BudgetRolloverMode } from '@/entities/budget.entity';
import { limitAt, limitHistoryAfter } from '@/modules/budgets/budget-limit-history';
import { percentOf, resolveAvailable } from '@/modules/budgets/budget-rollover.util';

/** Past periods that all had a limit of 100. */
const at100 = (spent: number[]) => spent.map(value => ({ spent: value, limit: 100 }));

describe('resolveAvailable', () => {
  it('starts every period at the limit without rollover', () => {
    expect(resolveAvailable(100, BudgetRolloverMode.NONE, at100([20, 150]))).toEqual({
      carriedAmount: 0,
      availableAmount: 100,
    });
    expect(resolveAvailable(100, undefined, at100([20]))).toEqual({ carriedAmount: 0, availableAmount: 100 });
  });

  it('carries leftover and overspend whole into the next period', () => {
    // 100 − 30 = 70 left, then 170 − 200 = −30 overspent → 70 available now.
    expect(resolveAvailable(100, BudgetRolloverMode.CARRY, at100([30, 200]))).toEqual({
      carriedAmount: -30,
      availableAmount: 70,
    });
    expect(resolveAvailable(100, BudgetRolloverMode.CARRY, at100([0, 0]))).toEqual({
      carriedAmount: 200,
      availableAmount: 300,
    });
  });

  it('refills up to the limit and never above it, but still deducts overspend', () => {
    expect(resolveAvailable(100, BudgetRolloverMode.REFILL, at100([0, 0]))).toEqual({
      carriedAmount: 0,
      availableAmount: 100,
    });
    expect(resolveAvailable(100, BudgetRolloverMode.REFILL, at100([130]))).toEqual({
      carriedAmount: -30,
      availableAmount: 70,
    });
    // A dent is repaired by the next untouched period.
    expect(resolveAvailable(100, BudgetRolloverMode.REFILL, at100([130, 0]))).toEqual({
      carriedAmount: 0,
      availableAmount: 100,
    });
  });
});

describe('percentOf', () => {
  it('can pass 100 and reads 100 when nothing is available but something was spent', () => {
    expect(percentOf(150, 100)).toBe(150);
    expect(percentOf(10, 0)).toBe(100);
    expect(percentOf(0, 0)).toBe(0);
    expect(percentOf(0, -20)).toBe(0);
  });
});

describe('a rollover budget whose limit changed', () => {
  // Six past months, each spent exactly to its limit.
  const months = (limit: number) => Array.from({ length: 6 }, () => ({ spent: limit, limit }));

  it('has the new limit available after a raise, not six months of the difference', () => {
    expect(resolveAvailable(200, BudgetRolloverMode.CARRY, months(100))).toEqual({
      carriedAmount: 0,
      availableAmount: 200,
    });
  });

  it('has the new limit available after a cut, not six months in the red', () => {
    for (const mode of [BudgetRolloverMode.CARRY, BudgetRolloverMode.REFILL]) {
      expect(resolveAvailable(100, mode, months(200))).toEqual({ carriedAmount: 0, availableAmount: 100 });
    }
  });
});

describe('limit history', () => {
  const budget = {
    limitAmount: 300,
    limitHistory: [
      { until: '2026-09-15', amount: 200 },
      { until: '2026-06-01', amount: 100 },
    ],
  };

  it('gives a period the limit it ended under', () => {
    expect(limitAt(budget, new Date(2026, 4, 31))).toBe(100);
    expect(limitAt(budget, new Date(2026, 5, 30))).toBe(200);
    expect(limitAt(budget, new Date(2026, 8, 14))).toBe(200);
    expect(limitAt(budget, new Date(2026, 8, 30))).toBe(300);
  });

  it('counts at the current limit with no history', () => {
    expect(limitAt({ limitAmount: 150, limitHistory: [] }, new Date(2020, 0, 31))).toBe(150);
  });

  it('records the old limit up to the day it changed, and nothing when it stays', () => {
    const today = new Date(2026, 10, 23);

    expect(limitHistoryAfter({ limitAmount: 100, limitHistory: [] }, { limitAmount: 200 }, today)).toEqual({
      limitHistory: [{ until: '2026-11-23', amount: 100 }],
    });
    expect(limitHistoryAfter({ limitAmount: 100, limitHistory: [] }, { limitAmount: '100.00' }, today)).toEqual({});
    expect(limitHistoryAfter({ limitAmount: 100, limitHistory: [] }, {}, today)).toEqual({});
  });
});
