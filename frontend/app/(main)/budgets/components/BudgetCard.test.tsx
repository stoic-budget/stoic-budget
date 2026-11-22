// @vitest-environment jsdom
import { screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { budgetItem, categoryRef } from '@/app/test/fixtures/contracts';
import { renderWithQuery } from '@/app/test/query-wrapper';
import { normalizeBudgetItem } from '../hooks/useBudgetsPage';
import { BudgetCard } from './BudgetCard';

const appLocale = vi.hoisted(() => ({ current: 'en' }));

vi.mock('@/app/i18n', async importOriginal => ({
  ...(await importOriginal<typeof import('@/app/i18n')>()),
  useLocale: () => ({ locale: appLocale.current }),
}));

const card = (overrides: Parameters<typeof budgetItem>[0], showPerDay = true) =>
  renderWithQuery(<BudgetCard
      budget={normalizeBudgetItem(budgetItem(overrides))}
      showPerDay={showPerDay}
      onEdit={vi.fn()}
      onDelete={vi.fn()} />);

describe('BudgetCard', () => {
  it('says which spending is left out for want of a rate, instead of hiding it', () => {
    card({
      id: 'b-1',
      name: 'Charity',
      limitAmount: '20.00',
      availableAmount: 20,
      spentAmount: 5,
      percentUsed: 25,
      unconvertedSpending: [{ currency: 'XYZ', amount: 150 }],
    });

    // The amount is an element of its own (privacy mode); the note is around it.
    const note = screen.getByText(/XYZ/).parentElement as HTMLElement;
    expect(note.textContent).toContain('150');
    expect(note.textContent).toContain('USD');
  });

  it('says what subscriptions paid from it still take this period', () => {
    const { container } = card({
      id: 'b-1',
      name: 'Software',
      subscriptionReserve: {
        amount: 30,
        items: [
          { subscriptionId: 's-1', vendorName: 'ACME Music', amount: 10 },
          { subscriptionId: 's-2', vendorName: 'Example Cloud', amount: 20 },
        ],
      },
    });

    const note = screen.getByText(/Reserved for subscriptions/);
    expect(note.textContent).toMatch(/30/);
    expect(note).toHaveAttribute('title', 'ACME Music, Example Cloud');
    expect(container.textContent).toContain('Reserved for subscriptions');
  });

  it('adds no note when every row was converted', () => {
    const { container } = card({ id: 'b-1', name: 'Charity', spentAmount: 12, percentUsed: 60 });

    expect(container.textContent).not.toMatch(/XYZ|UAH/);
  });

  it("names a system category in the reader's language, not as it was stored", () => {
    appLocale.current = 'ru';
    const { container } = card({
      id: 'b-ad',
      name: 'Реклама вакансий',
      category: categoryRef({ id: 'cat-ad', name: 'Advertising', isSystem: true }),
    });
    appLocale.current = 'en';

    expect(container.textContent).toContain('Реклама ·');
    expect(container.textContent).not.toContain('Advertising');
  });

  it('keeps the name of a category the user made', () => {
    const { container } = card({
      id: 'b-own',
      name: 'Gifts',
      category: categoryRef({ id: 'cat-own', name: 'Donate' }),
    });

    expect(container.textContent).toContain('Donate ·');
  });

  it('shows when a budget starts and the spending before that it leaves out', () => {
    const { container } = card({
      id: 'b-window',
      name: 'Реклама вакансий',
      startsOn: '2026-10-16',
      spentAmount: 0,
      percentUsed: 0,
      beforeStartSpending: [{ currency: 'ILS', amount: 8.9 }],
    });

    expect(container.textContent).toContain('from Oct 16');
    expect(container.textContent).toMatch(/Not counted: .*8\.90 — spent before the budget starts/);
  });

  it('says nothing about a start when the budget has none', () => {
    const { container } = card({ id: 'b-open', name: 'Charity' });

    expect(container.textContent).not.toMatch(/from |Not counted/);
  });

  describe('what is left per day', () => {
    const may = { periodStart: '2026-05-01', periodEnd: '2026-05-31' };
    // Sixty of a hundred left.
    const spentForty = { availableAmount: 100, spentAmount: 40, percentUsed: 40 };
    const on = (day: Date) => vi.useFakeTimers({ toFake: ['Date'] }).setSystemTime(day);

    afterEach(() => {
      vi.useRealTimers();
    });

    it('spreads what is left over the days left, today included', () => {
      on(new Date(2026, 4, 22, 9, 0));
      card({ id: 'b-day', name: 'Groceries', ...may, ...spentForty });

      const line = screen.getByText(/a day for the next 10 days/);
      expect(line.textContent).toBe('About $6.00 a day for the next 10 days');
      // The amount hides in privacy mode like the card's other figures.
      expect(screen.getByText('$6.00')).toHaveClass('seneca-private');
    });

    it('says what is left for today on the last day', () => {
      on(new Date(2026, 4, 31, 23, 50));
      const { container } = card({ id: 'b-day', name: 'Groceries', ...may, ...spentForty });

      expect(container.textContent).toContain('$60.00 left for today');
    });

    it('says nothing per day once the budget is overspent', () => {
      on(new Date(2026, 4, 22, 9, 0));
      const { container } = card({
        id: 'b-over',
        name: 'Groceries',
        ...may,
        availableAmount: 100,
        spentAmount: 120,
        percentUsed: 120,
      });

      expect(container.textContent).not.toMatch(/a day|for today/);
    });

    it('says nothing per day for a past month', () => {
      on(new Date(2026, 5, 3, 9, 0));
      const { container } = card({ id: 'b-past', name: 'Groceries', ...may, ...spentForty });

      expect(container.textContent).not.toMatch(/a day|for today/);
    });

    // October viewed later is measured on Oct 31; the quarter, year or week the
    // server answers for that day can still contain today.
    it.each([
      ['quarterly', '2026-10-01', '2026-12-31', 13],
      ['annual', '2026-01-01', '2026-12-31', 13],
      // Oct 31 is a Saturday: its week runs to Sunday, Nov 1.
      ['weekly', '2026-10-26', '2026-11-01', 1],
    ] as const)('says nothing per day for a %s budget on a past month view', (periodType, periodStart, periodEnd, novemberDay) => {
      on(new Date(2026, 10, novemberDay, 9, 0));
      const budget = { id: 'b-long', name: 'Insurance', periodType, periodStart, periodEnd, ...spentForty };

      const pastView = card(budget, false);
      expect(pastView.container.textContent).not.toMatch(/a day|for today/);
      pastView.unmount();
      // The same answer on the current view does get the line: the hiding is the view's doing.
      expect(card(budget, true).container.textContent).toMatch(
        /a day for the next \d+ days|left for today/,
      );
    });

    it('counts down to where the budget ends, carried leftover included', () => {
      on(new Date(2026, 4, 16, 9, 0));
      card({
        id: 'b-ends',
        name: 'Moving costs',
        periodStart: '2026-05-01',
        periodEnd: '2026-05-20',
        endsOn: '2026-05-20',
        limitAmount: '100.00',
        availableAmount: 150,
        carriedAmount: 50,
        spentAmount: 50,
        percentUsed: 33,
      });

      expect(screen.getByText(/a day for the next 5 days/).textContent).toBe(
        'About $20.00 a day for the next 5 days',
      );
    });
  });
});
