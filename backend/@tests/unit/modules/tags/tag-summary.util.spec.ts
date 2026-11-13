import {
  MAX_MONTHS,
  monthsBetween,
  summarizeTag,
  type TagSummaryRow,
} from '@/modules/tags/tag-summary.util';

const row = (
  day: string,
  type: TagSummaryRow['type'],
  amount: number,
  categoryId: string | null = 'food',
  payeeId: string | null = null,
): TagSummaryRow => ({ day, type, amount, categoryId, payeeId, count: 1 });

const names = {
  categories: new Map([
    ['food', 'Food'],
    ['lodging', 'Lodging'],
    ['salary', 'Salary'],
  ]),
  payees: new Map([
    ['p-hotel', 'Example Hotel'],
    ['p-cafe', 'Example Cafe'],
  ]),
};

describe('monthsBetween', () => {
  it('lists every month from the first to the last, over a new year', () => {
    expect(monthsBetween('2025-11', '2026-02')).toEqual([
      '2025-11',
      '2025-12',
      '2026-01',
      '2026-02',
    ]);
  });

  it('gives one month when the span is one month', () => {
    expect(monthsBetween('2026-03', '2026-03')).toEqual(['2026-03']);
  });

  it('keeps the latest 24 months of a longer span', () => {
    const months = monthsBetween('2020-01', '2026-06');
    expect(months).toHaveLength(MAX_MONTHS);
    expect(months[0]).toBe('2024-07');
    expect(months.at(-1)).toBe('2026-06');
  });
});

describe('summarizeTag', () => {
  it('adds both sides over all time and spans the first to the last day', () => {
    const summary = summarizeTag(
      [
        row('2026-03-10', 'expense', 120, 'lodging', 'p-hotel'),
        row('2026-01-05', 'expense', 30, 'food', 'p-cafe'),
        row('2026-03-12', 'income', 20, 'food', 'p-hotel'),
      ],
      names,
    );
    expect(summary).toMatchObject({
      spent: 150,
      received: 20,
      net: -130,
      firstDate: '2026-01-05',
      lastDate: '2026-03-12',
      direction: 'expense',
    });
  });

  it('draws a month inside the span without a row as zero', () => {
    const summary = summarizeTag(
      [row('2026-01-05', 'expense', 30), row('2026-03-10', 'expense', 120)],
      names,
    );
    expect(summary.months).toEqual([
      { month: '2026-01', amount: 30 },
      { month: '2026-02', amount: 0 },
      { month: '2026-03', amount: 120 },
    ]);
  });

  it('breaks the spending down by category and payee, leaving income out of both', () => {
    const summary = summarizeTag(
      [
        row('2026-03-10', 'expense', 120, 'lodging', 'p-hotel'),
        row('2026-03-11', 'expense', 30, 'food', 'p-cafe'),
        row('2026-03-11', 'expense', 10, null, 'p-cafe'),
        row('2026-03-12', 'income', 20, 'food', 'p-hotel'),
        row('2026-03-12', 'expense', 500, 'salary'),
        row('2026-03-13', 'expense', 1, 'food'),
      ],
      names,
    );
    expect(summary.categories).toEqual([
      { id: 'salary', name: 'Salary', amount: 500 },
      { id: 'lodging', name: 'Lodging', amount: 120 },
      { id: 'food', name: 'Food', amount: 31 },
      { id: null, name: null, amount: 10 },
    ]);
    expect(summary.topPayees).toEqual([
      { id: 'p-hotel', name: 'Example Hotel', amount: 120, count: 1 },
      { id: 'p-cafe', name: 'Example Cafe', amount: 40, count: 2 },
    ]);
  });

  it('spans the bars over the side they show, not a late refund on the other', () => {
    const summary = summarizeTag(
      [row('2022-03-10', 'expense', 900, 'lodging'), row('2026-05-02', 'income', 40, 'lodging')],
      names,
    );
    expect(summary.lastDate).toBe('2026-05-02');
    expect(summary.months).toEqual([{ month: '2022-03', amount: 900 }]);
  });

  it('shows the income side when a tag mostly received money', () => {
    const summary = summarizeTag(
      [row('2026-02-01', 'income', 900, 'salary'), row('2026-02-02', 'expense', 100, 'food')],
      names,
    );
    expect(summary.direction).toBe('income');
    expect(summary.net).toBe(800);
    expect(summary.months).toEqual([{ month: '2026-02', amount: 900 }]);
    expect(summary.categories).toEqual([{ id: 'salary', name: 'Salary', amount: 900 }]);
  });

  it('gives an unused tag zeros, no span and no bars', () => {
    expect(summarizeTag([], names)).toEqual({
      spent: 0,
      received: 0,
      net: 0,
      firstDate: null,
      lastDate: null,
      direction: 'expense',
      months: [],
      categories: [],
      topPayees: [],
    });
  });
});
