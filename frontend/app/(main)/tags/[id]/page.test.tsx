// @vitest-environment jsdom
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { parseISO } from 'date-fns';
import type React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TagSummary } from '@/app/lib/contracts';
import { formatMoney } from '@/app/lib/format-money';
import { formatStoredDate } from '@/app/lib/user-format-store';
import { apiResponse } from '@/app/test/api-response';
import { renderWithQuery } from '@/app/test/query-wrapper';
import TagPage from './page';

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() }));

vi.mock('@/app/lib/api', () => ({ default: api, apiBaseUrl: 'http://api.test' }));
vi.mock('@/app/hooks/useWorkspaceId', () => ({ useWorkspaceId: () => 'ws-1' }));
vi.mock('next/navigation', () => ({
  useParams: () => ({ id: 't-trip' }),
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}));
vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children?: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));
// The shared list (category and payee pages too); here it shows what it was asked for.
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
  }) => (
    <section data-testid="rows" data-filter={JSON.stringify(filter)}>
      <h2>{title}</h2>
      <p>{empty}</p>
      {aside}
    </section>
  ),
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
      }),
  };
});

const filterOf = () => JSON.parse(screen.getByTestId('rows').dataset.filter ?? '{}');

const summaryOf = (overrides: Partial<TagSummary> = {}): TagSummary => ({
  tag: {
    id: 't-trip',
    name: 'Example Trip',
    color: null,
    description: null,
    tagDate: null,
  },
  currency: 'EUR',
  spent: 0,
  received: 0,
  net: 0,
  firstDate: null,
  lastDate: null,
  direction: 'expense',
  months: [],
  categories: [],
  topPayees: [],
  missingRates: [],
  ...overrides,
});

const used = (): Partial<TagSummary> => ({
  spent: 235,
  received: 15,
  net: -220,
  firstDate: '2026-03-10',
  lastDate: '2026-05-08',
  months: [
    { month: '2026-03', amount: 100 },
    { month: '2026-04', amount: 0 },
    { month: '2026-05', amount: 135 },
  ],
  categories: [
    { id: 'c-lodging', name: 'Lodging', amount: 125 },
    { id: null, name: null, amount: 110 },
  ],
  topPayees: [{ id: 'p-hotel', name: 'Example Hotel', amount: 100, count: 1 }],
});

let summary = summaryOf();

describe('TagPage', () => {
  beforeEach(() => {
    summary = summaryOf();
    api.get.mockReset().mockImplementation((url: string) =>
      url === '/tags/t-trip/summary'
        ? Promise.resolve(apiResponse(summary))
        : Promise.reject(new Error(`unexpected ${url}`)),
    );
  });

  it('shows skeletons while the tag loads', () => {
    api.get.mockReturnValue(new Promise(() => undefined));
    const { container } = renderWithQuery(<TagPage />);

    expect(container.querySelectorAll('[aria-busy="true"]').length).toBeGreaterThan(0);
    expect(screen.queryByRole('heading', { level: 1 })).toBeNull();
  });

  it('shows a tag nothing counted carries as zeros, no span, no bars and no breakdown', async () => {
    renderWithQuery(<TagPage />);

    expect(await screen.findByRole('heading', { level: 1, name: 'Example Trip' })).toBeTruthy();
    expect(screen.getAllByText('€0.00')).toHaveLength(3);
    expect(screen.getAllByText('—')).toHaveLength(2);
    expect(screen.getByText('nothingCounted')).toBeTruthy();
    expect(screen.queryByText('spentByMonth')).toBeNull();
    expect(screen.queryByText('categoriesTitle')).toBeNull();
    expect(screen.getByText('noTransactions')).toBeTruthy();
    expect(filterOf()).toEqual({ tagId: 't-trip' });
  });

  it('shows the figures, the span and the tag’s own date', async () => {
    summary = summaryOf({
      ...used(),
      tag: { ...summaryOf().tag, description: 'Summer by the sea', tagDate: '2026-04-01' },
      missingRates: ['ZZM'],
    });
    renderWithQuery(<TagPage />);

    expect(await screen.findByText('€235.00')).toBeTruthy();
    expect(screen.getByText('€15.00')).toBeTruthy();
    expect(screen.getByText(formatMoney(-220, 'EUR', 'en'))).toBeTruthy();
    expect(screen.getByText(formatStoredDate(parseISO('2026-03-10')))).toBeTruthy();
    expect(screen.getByText(formatStoredDate(parseISO('2026-05-08')))).toBeTruthy();
    expect(screen.getByText(/Summer by the sea/).textContent).toContain(
      formatStoredDate(parseISO('2026-04-01')),
    );
    expect(screen.getByText('Not counted: no exchange rate for ZZM')).toBeTruthy();
    expect(screen.getByText('spentByMonth')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: /2026:/ })).toHaveLength(3);
  });

  it('narrows the rows to a month when its bar is pressed, and back', async () => {
    summary = summaryOf(used());
    renderWithQuery(<TagPage />);

    const bar = await screen.findByRole('button', { name: /May 2026/ });
    fireEvent.click(bar);

    await waitFor(() =>
      expect(filterOf()).toEqual({
        tagId: 't-trip',
        date_from: '2026-05-01',
        date_to: '2026-05-31',
      }),
    );
    expect(bar.getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('heading', { name: 'Transactions in May 2026' })).toBeTruthy();
    expect(screen.getByText('noMonthTransactions')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'showAll' }));
    await waitFor(() => expect(filterOf()).toEqual({ tagId: 't-trip' }));
    expect(bar.getAttribute('aria-pressed')).toBe('false');
  });

  it('breaks the money down by category and payee, each linking to its page', async () => {
    summary = summaryOf(used());
    renderWithQuery(<TagPage />);

    expect((await screen.findByRole('link', { name: 'Lodging' })).getAttribute('href')).toBe(
      '/categories/c-lodging',
    );
    // A row without a category has no page to open.
    expect(screen.getByText('uncategorized').closest('a')).toBeNull();
    expect(screen.getByRole('link', { name: 'Example Hotel' }).getAttribute('href')).toBe(
      '/statements/payees/p-hotel',
    );
  });

  it('titles the bars by the side the tag mostly moved', async () => {
    summary = summaryOf({
      ...used(),
      spent: 100,
      received: 900,
      net: 800,
      direction: 'income',
    });
    renderWithQuery(<TagPage />);

    expect(await screen.findByText('receivedByMonth')).toBeTruthy();
    expect(screen.queryByText('spentByMonth')).toBeNull();
  });

  it('says so when the tag is not there', async () => {
    api.get.mockRejectedValue(Object.assign(new Error('Not found'), { response: { status: 404 } }));
    renderWithQuery(<TagPage />);

    expect(await screen.findByText('notFound')).toBeTruthy();
  });
});
