import { describe, expect, it } from 'vitest';
import { budgetItem } from '@/app/test/fixtures/contracts';
import { leftToSpend } from './left-to-spend';

const MONTH = '2026-10';

describe('leftToSpend', () => {
  it('is null without any budget, so the tile keeps showing what was spent', () => {
    expect(leftToSpend([], MONTH)).toBeNull();
  });

  it('is null when the only budget starts after the month', () => {
    const budget = budgetItem({ id: 'b-1', name: 'Groceries', startsOn: '2026-11-01' });

    expect(leftToSpend([budget], MONTH)).toBeNull();
  });

  it('is null when the only budget ended before the month', () => {
    const budget = budgetItem({ id: 'b-1', name: 'Groceries', endsOn: '2026-09-30' });

    expect(leftToSpend([budget], MONTH)).toBeNull();
  });

  it('leaves out a budget that starts after the month when another one counts', () => {
    const counted = budgetItem({ id: 'b-1', name: 'Groceries', availableAmount: 100, spentAmount: 40 });
    const later = budgetItem({
      id: 'b-2',
      name: 'Travel',
      startsOn: '2026-11-01',
      availableAmount: 500,
      spentAmount: 0,
    });

    expect(leftToSpend([counted, later], MONTH)).toEqual([{ currency: 'USD', amount: 60, allowed: 100 }]);
  });

  it('counts a budget without a window as what it still allows', () => {
    const budget = budgetItem({ id: 'b-1', name: 'Groceries', availableAmount: 300, spentAmount: 120 });

    expect(leftToSpend([budget], MONTH)).toEqual([{ currency: 'USD', amount: 180, allowed: 300 }]);
  });

  it('counts a budget that starts during the month', () => {
    const budget = budgetItem({
      id: 'b-1',
      name: 'Groceries',
      startsOn: '2026-10-15',
      availableAmount: 200,
      spentAmount: 50,
    });

    expect(leftToSpend([budget], MONTH)).toEqual([{ currency: 'USD', amount: 150, allowed: 200 }]);
  });

  it('counts a budget that ends during the month', () => {
    const budget = budgetItem({
      id: 'b-1',
      name: 'Groceries',
      endsOn: '2026-10-01',
      availableAmount: 200,
      spentAmount: 50,
    });

    expect(leftToSpend([budget], MONTH)).toEqual([{ currency: 'USD', amount: 150, allowed: 200 }]);
  });

  it('adds budgets up per currency', () => {
    const budgets = [
      budgetItem({ id: 'b-1', name: 'Groceries', availableAmount: 300, spentAmount: 100 }),
      budgetItem({ id: 'b-2', name: 'Travel', availableAmount: 50, spentAmount: 20 }),
      budgetItem({
        id: 'b-3',
        name: 'Rent',
        currency: 'EUR',
        availableAmount: 900,
        spentAmount: 0,
      }),
    ];

    expect(leftToSpend(budgets, MONTH)).toEqual([
      { currency: 'USD', amount: 230, allowed: 350 },
      { currency: 'EUR', amount: 900, allowed: 900 },
    ]);
  });

  it('goes below zero once the month is over budget', () => {
    const budget = budgetItem({ id: 'b-1', name: 'Groceries', availableAmount: 100, spentAmount: 130 });

    expect(leftToSpend([budget], MONTH)).toEqual([{ currency: 'USD', amount: -30, allowed: 100 }]);
  });

  it('counts monthly budgets only: a weekly or annual one is not a month', () => {
    const monthly = budgetItem({ id: 'b-1', name: 'Groceries', availableAmount: 300, spentAmount: 120 });
    const annual = budgetItem({
      id: 'b-2',
      name: 'Holidays',
      periodType: 'annual',
      availableAmount: 2400,
      spentAmount: 900,
    });

    expect(leftToSpend([monthly, annual], MONTH)).toEqual([{ currency: 'USD', amount: 180, allowed: 300 }]);
  });

  it("leaves a subcategory's budget to its parent's, so its spending counts once", () => {
    const food = budgetItem({ id: 'b-1', name: 'Food', categoryId: 'cat-food', availableAmount: 500, spentAmount: 200 });
    const parentId = 'cat-food';
    const groceries = budgetItem({
      id: 'b-2',
      name: 'Groceries',
      categoryId: 'cat-groceries',
      availableAmount: 300,
      spentAmount: 150,
    });
    groceries.category = { ...groceries.category, parentId };

    expect(leftToSpend([food, groceries], MONTH)).toEqual([{ currency: 'USD', amount: 300, allowed: 500 }]);
  });

  it("keeps a subcategory's budget when its parent's budget is not one the tile counts", () => {
    const annualFood = budgetItem({
      id: 'b-1',
      name: 'Food',
      categoryId: 'cat-food',
      periodType: 'annual',
      availableAmount: 6000,
      spentAmount: 200,
    });
    const groceries = budgetItem({
      id: 'b-2',
      name: 'Groceries',
      categoryId: 'cat-groceries',
      availableAmount: 500,
      spentAmount: 450,
    });
    groceries.category = { ...groceries.category, parentId: 'cat-food' };

    expect(leftToSpend([annualFood, groceries], MONTH)).toEqual([{ currency: 'USD', amount: 50, allowed: 500 }]);
  });

  it('leaves a budget to one on any category above it, not only its parent (#658)', () => {
    const top = budgetItem({ id: 'b-top', name: 'Food', categoryId: 'food', availableAmount: 500, spentAmount: 200 });
    // Groceries → Food → (no budget) → Fruit, budgeted two levels below Food.
    const fruit = budgetItem({
      id: 'b-fruit',
      name: 'Fruit',
      categoryId: 'fruit',
      category: { ...top.category, id: 'fruit', parentId: 'groceries' },
      availableAmount: 50,
      spentAmount: 30,
    });
    const parentOf = new Map<string, string | null>([
      ['fruit', 'groceries'],
      ['groceries', 'food'],
      ['food', null],
    ]);

    expect(leftToSpend([top, fruit], MONTH, parentOf)).toEqual([{ currency: 'USD', amount: 300, allowed: 500 }]);
  });

  it("counts a goal's budget only where no standalone budget covers its category (#658)", () => {
    const groceries = budgetItem({ id: 'b-1', name: 'Groceries', categoryId: 'groceries', availableAmount: 300, spentAmount: 100 });
    const goal = budgetItem({ id: 'b-2', name: 'Groceries for the trip', categoryId: 'groceries', goalId: 'trip', availableAmount: 100, spentAmount: 100 });
    const travel = budgetItem({ id: 'b-3', name: 'Travel', categoryId: 'travel', goalId: 'trip', availableAmount: 80, spentAmount: 20 });

    expect(leftToSpend([groceries, goal, travel], MONTH)).toEqual([{ currency: 'USD', amount: 260, allowed: 380 }]);
  });
});
