import {
  branchesOf,
  type CategoryNode,
  type SummaryRow,
  summarize,
} from '@/modules/categories/category-summary.util';

const food: CategoryNode = { id: 'food', name: 'Food', parentId: null };
const groceries: CategoryNode = { id: 'groceries', name: 'Groceries', parentId: 'food' };
const organic: CategoryNode = { id: 'organic', name: 'Organic', parentId: 'groceries' };
const cafes: CategoryNode = { id: 'cafes', name: 'Cafes', parentId: 'food' };
const travel: CategoryNode = { id: 'travel', name: 'Travel', parentId: null };
const categories = [food, groceries, organic, cafes, travel];

// Twelve months ending with 2026-06, oldest first.
const months = Array.from(
  { length: 12 },
  (_, index) => `${index < 6 ? 2025 : 2026}-${String(((index + 6) % 12) + 1).padStart(2, '0')}`,
);
const row = (day: string, categoryId: string, amount: number, payeeId: string | null = null) =>
  ({ day, categoryId, amount, payeeId, count: 1 }) satisfies SummaryRow;
const payees = new Map([
  ['p-store', 'ACME Store'],
  ['p-cafe', 'Example Cafe'],
  ['p-cafe-2', 'Example Diner'],
]);

describe('branchesOf', () => {
  it('maps every descendant to its direct child of the root, and the root to itself', () => {
    expect(Object.fromEntries(branchesOf('food', categories))).toEqual({
      food: 'food',
      groceries: 'groceries',
      organic: 'groceries',
      cafes: 'cafes',
    });
  });

  it('ends at a loop of parents instead of walking it forever', () => {
    const loop = [
      { id: 'a', name: 'A', parentId: 'b' },
      { id: 'b', name: 'B', parentId: 'a' },
    ];
    expect(Object.fromEntries(branchesOf('a', loop))).toEqual({ a: 'a', b: 'b' });
  });
});

describe('summarize', () => {
  it('sums the months, this month and the year with subcategories included', () => {
    const result = summarize(
      food,
      categories,
      [
        row('2026-06-02', 'food', 10),
        row('2026-06-03', 'organic', 5),
        row('2026-05-10', 'cafes', 20),
      ],
      months,
      payees,
    );
    expect(result.months).toHaveLength(12);
    expect(result.months.at(-1)).toEqual({ month: '2026-06', amount: 15 });
    expect(result.thisMonth).toBe(15);
    expect(result.lastYearTotal).toBe(35);
  });

  it('averages only the full months that had rows, not the gap, not this month', () => {
    const result = summarize(
      food,
      categories,
      // An old row, a long gap, one recent month, and this month still running.
      [row('2025-07-05', 'food', 90), row('2026-05-05', 'food', 30), row('2026-06-01', 'food', 1)],
      months,
      payees,
    );
    expect(result.averagePerMonth).toBe(60);
  });

  it('counts a month a refund netted to nothing as a month, not a gap', () => {
    const result = summarize(
      food,
      categories,
      [row('2026-04-05', 'food', 30), row('2026-04-09', 'food', -30), row('2026-05-05', 'food', 60)],
      months,
      payees,
    );
    expect(result.averagePerMonth).toBe(30);
    expect(result.lastYearTotal).toBe(60);
  });

  it('has no average when only this month has rows', () => {
    const result = summarize(food, categories, [row('2026-06-01', 'food', 7)], months, payees);
    expect(result.averagePerMonth).toBeNull();
    expect(result.thisMonth).toBe(7);
  });

  it('breaks a parent down by direct subcategory, its own rows under its own id', () => {
    const result = summarize(
      food,
      categories,
      [
        row('2026-06-02', 'food', 10),
        row('2026-06-03', 'organic', 5),
        row('2026-06-03', 'groceries', 25),
        row('2026-05-10', 'cafes', 20),
      ],
      months,
      payees,
    );
    expect(result.subcategories).toEqual([
      { id: 'groceries', name: 'Groceries', amount: 30 },
      { id: 'cafes', name: 'Cafes', amount: 20 },
      { id: 'food', name: 'Food', amount: 10 },
    ]);
  });

  it('gives a category without subcategories no breakdown', () => {
    const result = summarize(travel, categories, [row('2026-06-02', 'travel', 10)], months, payees);
    expect(result.subcategories).toEqual([]);
  });

  it('ranks payees by amount and leaves out rows without a readable payee', () => {
    const result = summarize(
      food,
      categories,
      [
        row('2026-06-02', 'food', 10, 'p-store'),
        row('2026-06-04', 'groceries', 15, 'p-store'),
        row('2026-06-03', 'cafes', 20, 'p-cafe'),
        // Another member's private row, or a row without a payee.
        row('2026-06-05', 'food', 99, null),
        // A row whose currency had no rate: nothing to rank it by.
        row('2026-06-06', 'food', 0, 'p-cafe-2'),
      ],
      months,
      payees,
    );
    expect(result.topPayees).toEqual([
      { id: 'p-store', name: 'ACME Store', amount: 25, count: 2 },
      { id: 'p-cafe', name: 'Example Cafe', amount: 20, count: 1 },
    ]);
    expect(result.lastYearTotal).toBe(144);
  });
});
