// @vitest-environment jsdom
import { screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DonutSlice } from '@/app/components/charts/CategoryDonut';
import { OverviewMonthProvider } from '@/app/components/dashboard/overview-month';
import { renderWithQuery } from '@/app/test/query-wrapper';
import { SubscriptionsMonthWidget } from './SubscriptionsMonthWidget';

const apiGet = vi.hoisted(() => vi.fn());

vi.mock('@/app/lib/api', () => ({ default: { get: apiGet }, apiBaseUrl: '/api/v1' }));
vi.mock('@/app/hooks/useWorkspaceId', () => ({ useWorkspaceId: () => 'ws-1' }));
vi.mock('@/app/components/charts/lazy-charts', () => ({
  LazyCategoryDonut: ({ slices }: { slices: DonutSlice[] }) => (
    <div data-testid="donut">
      {slices
        .map(slice => `${slice.key}:${slice.value}${slice.details ? `[${slice.details.join('|')}]` : ''}`)
        .join(',')}
    </div>
  ),
}));
vi.mock('@/app/i18n', async () => {
  const { autoDictionary } = await import('@/app/components/dashboard/__tests__/intlayer-mock');
  return {
    useIntlayer: () => autoDictionary({ paid: { value: 'Paid' } }),
    useLocale: () => ({ locale: 'en' }),
  };
});
vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

const PAID = 14;
const UNPAID = 237.5;
const item = (overrides = {}) => ({
  subscriptionId: 'sub-1',
  vendorName: 'ACME Music',
  vendorDomain: null,
  amount: PAID,
  paid: true,
  nextChargeDate: '2026-11-03',
  ...overrides,
});
const status = (overrides = {}) => ({
  currency: 'EUR',
  month: '2026-10',
  paidAmount: PAID,
  paidCount: 1,
  unpaidAmount: UNPAID,
  unpaidCount: 1,
  paidByCurrency: [{ currency: 'EUR', amount: PAID }],
  unpaidByCurrency: [{ currency: 'EUR', amount: UNPAID }],
  items: [
    item({
      subscriptionId: 'sub-2',
      vendorName: 'Example Cloud',
      amount: UNPAID,
      paid: false,
      nextChargeDate: '2026-10-28',
    }),
    item(),
  ],
  ...overrides,
});

const money = (value: number) => `${value} €`;
const MONTH = '2026-10';
const MONTHLY = 80;
const summary = (overrides = {}) => ({
  totalMonthlyCost: MONTHLY,
  activeCount: 6,
  upcomingCount: 1,
  upcoming30DaysCount: 4,
  upcoming30DaysAmount: 0,
  priceChangeCount: 2,
  priceChangeYearlyEffect: 24,
  duplicateCount: 0,
  overdueReviewCount: 0,
  realizedAnnualSavings: 0,
  ...overrides,
});
/** Answers each endpoint with its own payload, as the widget asks two. */
const serve = (month: object, totals: object) =>
  apiGet.mockImplementation(async (url: string) => ({
    data: url === '/subscriptions/summary' ? totals : month,
  }));

describe('SubscriptionsMonthWidget', () => {
  beforeEach(() => {
    apiGet.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('asks for the Overview’s month and names it under the title', async () => {
    apiGet.mockResolvedValue({ data: status() });
    renderWithQuery(
      <OverviewMonthProvider value={MONTH}>
        <SubscriptionsMonthWidget formatAmount={money} />
      </OverviewMonthProvider>,
    );

    expect(await screen.findByText('October 2026')).toBeInTheDocument();
    expect(apiGet).toHaveBeenCalledWith(
      '/subscriptions/month-status',
      expect.objectContaining({ params: { month: MONTH } }),
    );
  });

  it('says on hover what each part is in the subscriptions’ own currencies', async () => {
    apiGet.mockResolvedValue({
      data: status({
        paidByCurrency: [{ currency: 'USD', amount: 10 }],
        unpaidByCurrency: [
          { currency: 'USD', amount: 100 },
          { currency: 'EUR', amount: 25 },
        ],
      }),
    });
    renderWithQuery(<SubscriptionsMonthWidget formatAmount={money} />);

    expect(await screen.findByTestId('donut')).toHaveTextContent(
      `paid:${PAID}[$10.00],unpaid:${UNPAID}[$100.00|€25.00]`,
    );
  });

  it('lists each subscription with its icon, its date or Paid, and its amount', async () => {
    apiGet.mockResolvedValue({ data: status() });
    renderWithQuery(<SubscriptionsMonthWidget formatAmount={money} />);

    // All in the workspace currency: the amount already says it, no extra lines.
    expect(await screen.findByTestId('donut')).toHaveTextContent(`paid:${PAID},unpaid:${UNPAID}`);
    const [unpaid, paid] = screen.getAllByRole('link', { name: /ACME Music|Example Cloud/ });
    expect(unpaid).toHaveTextContent('Example Cloud');
    expect(unpaid).toHaveTextContent('Oct 28');
    expect(unpaid).toHaveTextContent(money(UNPAID));
    expect(paid).toHaveTextContent('ACME Music');
    expect(paid).toHaveTextContent('Paid');
    expect(paid).toHaveTextContent(money(PAID));
    // Initials stand in for a vendor without a bundled mark or domain.
    expect(screen.getByText('E')).toBeInTheDocument();
  });

  it('links each row to its subscription, ringed on the Subscriptions page', async () => {
    apiGet.mockResolvedValue({ data: status() });
    renderWithQuery(<SubscriptionsMonthWidget formatAmount={money} />);

    const row = await screen.findByRole('link', { name: /Example Cloud/ });
    expect(row).toHaveAttribute('href', `/subscriptions?focus=${encodeURIComponent('subscription:sub-2')}`);
  });

  it('leaves an empty part out of the ring but keeps the subscription', async () => {
    apiGet.mockResolvedValue({
      data: status({ paidAmount: 0, paidCount: 0, items: [item({ paid: false, amount: UNPAID })] }),
    });
    renderWithQuery(<SubscriptionsMonthWidget formatAmount={money} />);

    expect(await screen.findByTestId('donut')).toHaveTextContent(`unpaid:${UNPAID}`);
    expect(screen.getByText('ACME Music')).toBeInTheDocument();
  });

  it('shows five subscriptions at most', async () => {
    const items = Array.from({ length: 7 }, (_, index) =>
      item({ subscriptionId: `sub-${index}`, vendorName: `Vendor ${index}` }),
    );
    apiGet.mockResolvedValue({ data: status({ items }) });
    renderWithQuery(<SubscriptionsMonthWidget formatAmount={money} />);

    expect(await screen.findByText('Vendor 4')).toBeInTheDocument();
    expect(screen.queryByText('Vendor 5')).toBeNull();
  });

  it('shows the empty state when nothing is charged this month', async () => {
    apiGet.mockResolvedValue({
      data: status({ paidAmount: 0, paidCount: 0, unpaidAmount: 0, unpaidCount: 0, items: [] }),
    });
    renderWithQuery(<SubscriptionsMonthWidget formatAmount={money} />);

    expect(await screen.findByText('emptyDescription')).toBeInTheDocument();
    expect(screen.queryByTestId('donut')).toBeNull();
  });

  it('says how soon this week’s charges are, in the month under way only', async () => {
    // Three days before Example Cloud charges on Oct 28.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 25, 12));
    serve(status(), summary());
    const { unmount } = renderWithQuery(
      <OverviewMonthProvider value={MONTH}>
        <SubscriptionsMonthWidget formatAmount={money} />
      </OverviewMonthProvider>,
    );

    const row = await screen.findByRole('link', { name: /Example Cloud/ });
    expect(row).toHaveTextContent('Oct 28 · in 3 days');
    expect(screen.getByRole('link', { name: /ACME Music/ })).not.toHaveTextContent('in ');

    unmount();
    vi.setSystemTime(new Date(2026, 10, 25, 12));
    renderWithQuery(
      <OverviewMonthProvider value={MONTH}>
        <SubscriptionsMonthWidget formatAmount={money} />
      </OverviewMonthProvider>,
    );
    const past = await screen.findByRole('link', { name: /Example Cloud/ });
    expect(past).toHaveTextContent('Oct 28');
    expect(past).not.toHaveTextContent('·');
  });

  it('adds what subscriptions cost a month and the flags from the summary', async () => {
    serve(status(), summary());
    renderWithQuery(<SubscriptionsMonthWidget formatAmount={money} />);

    expect(await screen.findByText('subscriptionsMonthly')).toBeInTheDocument();
    // The chip leads to the subscriptions it is about, ringed.
    expect(screen.getByText('priceChanges').closest('a')).toHaveAttribute(
      'href',
      '/subscriptions?focus=price-changed',
    );
    expect(screen.queryByText('duplicates')).toBeNull();
  });

  it('leaves the cost and the flags out when there is nothing to say', async () => {
    serve(status(), summary({ totalMonthlyCost: 0, priceChangeCount: 0 }));
    renderWithQuery(<SubscriptionsMonthWidget formatAmount={money} />);

    expect(await screen.findByText('Example Cloud')).toBeInTheDocument();
    await waitFor(() =>
      expect(apiGet).toHaveBeenCalledWith('/subscriptions/summary', expect.anything()),
    );
    expect(screen.queryByText('subscriptionsMonthly')).toBeNull();
    expect(screen.queryByText('priceChanges')).toBeNull();
  });
});
