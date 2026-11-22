// @vitest-environment jsdom
import { fireEvent, screen, waitFor } from '@testing-library/react';
import type React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CategorySummary } from '@/app/lib/contracts';
import { apiResponse } from '@/app/test/api-response';
import { categoryItem, categoryRef } from '@/app/test/fixtures/contracts';
import { renderWithQuery } from '@/app/test/query-wrapper';
import CategoryPage from './page';

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() }));
const listed = vi.hoisted(() => ({ filters: [] as unknown[] }));

vi.mock('@/app/lib/api', () => ({ default: api, apiBaseUrl: 'http://api.test' }));
vi.mock('@/app/hooks/useWorkspaceId', () => ({ useWorkspaceId: () => 'ws-1' }));
vi.mock('next/navigation', () => ({
  useParams: () => ({ id: 'c-food' }),
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}));
vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children?: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));
// The list is the shared one (payee page too); here it shows what it was asked for.
vi.mock('../../statements/transactions/components/FilteredTransactions', () => ({
  FilteredTransactions: ({
    filter,
    title,
    empty,
    aside,
  }: {
    filter: unknown;
    title: React.ReactNode;
    empty: React.ReactNode;
    aside?: React.ReactNode;
  }) => {
    listed.filters.push(filter);
    return (
      <section data-testid="rows" data-filter={JSON.stringify(filter)}>
        <h2>{title}</h2>
        <p>{empty}</p>
        {aside}
      </section>
    );
  },
}));
vi.mock('@/app/i18n', async () => {
  const { autoDictionary, value } = await import(
    '@/app/components/dashboard/__tests__/intlayer-mock'
  );
  return {
    useLocale: () => ({ locale: 'en' }),
    useIntlayer: () =>
      autoDictionary({
        monthTransactions: value('Transactions in {{month}}'),
        missingRates: value('Not counted: no exchange rate for {{currencies}}'),
        averageHint: value('Over the full months that had transactions'),
        otherSpending: value('Also filed here, not in the figures above: {{amount}} of spending'),
      }),
  };
});

const food = 'ACME Food';
const months = Array.from({ length: 12 }, (_, index) => ({
  month: `${index < 7 ? 2025 : 2026}-${String(((index + 5) % 12) + 1).padStart(2, '0')}`,
  amount: 0,
}));
const summaryOf = (overrides: Partial<CategorySummary> = {}): CategorySummary => ({
  currency: 'EUR',
  direction: 'expense',
  months,
  thisMonth: 0,
  averagePerMonth: null,
  lastYearTotal: 0,
  subcategories: [],
  topPayees: [],
  otherDirection: null,
  missingRates: [],
  ...overrides,
});

let category = categoryItem({ id: 'c-food', name: food });
let summary = summaryOf();
let reportsView: Record<string, unknown> | null = null;

function answer(url: string) {
  if (url === '/categories/c-food') {
    return Promise.resolve(apiResponse(category));
  }
  if (url === '/categories/c-food/summary') {
    return Promise.resolve(apiResponse(summary));
  }
  if (url === '/view-preferences/reports') {
    return Promise.resolve(apiResponse({ state: reportsView }));
  }
  return Promise.reject(new Error(`unexpected ${url}`));
}

describe('CategoryPage', () => {
  beforeEach(() => {
    listed.filters = [];
    category = categoryItem({ id: 'c-food', name: food });
    summary = summaryOf();
    reportsView = null;
    api.get.mockReset().mockImplementation(answer);
  });

  it('shows a skeleton while the category loads', () => {
    api.get.mockReturnValue(new Promise(() => undefined));
    const { container } = renderWithQuery(<CategoryPage />);

    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(screen.queryByRole('heading', { level: 1 })).toBeNull();
  });

  it('shows an empty category as zeros, no average and no breakdown', async () => {
    renderWithQuery(<CategoryPage />);

    expect(await screen.findByRole('heading', { level: 1, name: food })).toBeTruthy();
    await screen.findByText('—');
    expect(screen.getAllByText('€0.00')).toHaveLength(2);
    expect(screen.queryByText('subcategoriesTitle')).toBeNull();
    expect(screen.queryByText('payeesTitle')).toBeNull();
    expect(screen.getByText('noTransactions')).toBeTruthy();
    expect(JSON.parse(screen.getByTestId('rows').dataset.filter ?? '{}')).toEqual({
      categoryId: 'c-food',
      subcategories: '1',
    });
  });

  it('narrows the rows to a month when its bar is pressed, and back', async () => {
    summary = summaryOf({
      months: months.map((entry, index) => ({ ...entry, amount: index === 11 ? 120 : 0 })),
      lastYearTotal: 120,
      averagePerMonth: 120,
    });
    renderWithQuery(<CategoryPage />);

    const bar = await screen.findByRole('button', { name: /May 2026/ });
    fireEvent.click(bar);

    await waitFor(() =>
      expect(JSON.parse(screen.getByTestId('rows').dataset.filter ?? '{}')).toEqual({
        categoryId: 'c-food',
        subcategories: '1',
        date_from: '2026-05-01',
        date_to: '2026-05-31',
      }),
    );
    expect(bar.getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('heading', { name: 'Transactions in May 2026' })).toBeTruthy();
    expect(screen.getByText('noMonthTransactions')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'showAll' }));
    await waitFor(() =>
      expect(JSON.parse(screen.getByTestId('rows').dataset.filter ?? '{}')).toEqual({
        categoryId: 'c-food',
        subcategories: '1',
      }),
    );
    expect(bar.getAttribute('aria-pressed')).toBe('false');
  });

  it('breaks a parent down by subcategory and payee, each linking to its page', async () => {
    category = categoryItem({
      id: 'c-food',
      name: food,
      parent: categoryRef({ id: 'c-home', name: 'Household' }),
    });
    summary = summaryOf({
      lastYearTotal: 75,
      subcategories: [
        { id: 'c-groceries', name: 'Groceries', amount: 50 },
        { id: 'c-food', name: food, amount: 25 },
      ],
      topPayees: [{ id: 'p-store', name: 'ACME Store', amount: 50, count: 2 }],
      missingRates: ['ZZM'],
    });
    renderWithQuery(<CategoryPage />);

    expect((await screen.findByRole('link', { name: 'Groceries' })).getAttribute('href')).toBe(
      '/categories/c-groceries',
    );
    expect(screen.getByText('ownRows')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'ACME Store' }).getAttribute('href')).toBe(
      '/statements/payees/p-store',
    );
    expect(screen.getByRole('link', { name: 'Household' }).getAttribute('href')).toBe(
      '/categories/c-home',
    );
    expect(screen.getByText('Not counted: no exchange rate for ZZM')).toBeTruthy();
  });

  it('nets refunds as Reports does when this person turned that on there', async () => {
    reportsView = { netRefunds: true, includeTransfers: true };
    renderWithQuery(<CategoryPage />);

    await screen.findByRole('heading', { level: 1, name: food });
    await waitFor(() =>
      expect(api.get).toHaveBeenCalledWith(
        '/categories/c-food/summary',
        expect.objectContaining({ params: { netRefunds: true } }),
      ),
    );
    // Asked once, after the switch was known: never first without it.
    const asked = api.get.mock.calls.filter(([url]) => url === '/categories/c-food/summary');
    expect(asked).toHaveLength(1);
  });

  it('asks without netting when the Reports switch is off', async () => {
    reportsView = { netRefunds: false };
    renderWithQuery(<CategoryPage />);

    await waitFor(() =>
      expect(api.get).toHaveBeenCalledWith(
        '/categories/c-food/summary',
        expect.objectContaining({ params: {} }),
      ),
    );
  });

  it('names the rows of the other direction filed here, apart from the figures', async () => {
    category = categoryItem({ id: 'c-food', name: 'Salary', type: 'income' });
    summary = summaryOf({ direction: 'income', lastYearTotal: 900, otherDirection: { amount: 50 } });
    renderWithQuery(<CategoryPage />);

    expect(await screen.findByText('€50.00')).toBeTruthy();
    expect(screen.getByText(/Also filed here, not in the figures above/)).toBeTruthy();
  });

  it('says an income category is income', async () => {
    category = categoryItem({ id: 'c-food', name: 'Salary', type: 'income' });
    summary = summaryOf({ direction: 'income', thisMonth: 900, lastYearTotal: 900 });
    renderWithQuery(<CategoryPage />);

    expect(await screen.findByText('income')).toBeTruthy();
    expect(await screen.findAllByText('€900.00')).toHaveLength(2);
  });

  it('says so when the category is not there', async () => {
    api.get.mockRejectedValue(Object.assign(new Error('Not found'), { response: { status: 404 } }));
    renderWithQuery(<CategoryPage />);

    expect(await screen.findByText('notFound')).toBeTruthy();
  });
});
