// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClientProvider } from '@tanstack/react-query';
import { cryptoHolding, cryptoSummary } from '@/app/test/fixtures/contracts';
import { createTestQueryClient, renderWithQuery } from '@/app/test/query-wrapper';
import { CryptoPortfolioCard } from './CryptoPortfolioCard';
import { SectionSpanProvider } from './section-span';

const apiGet = vi.hoisted(() => vi.fn());

// `apiBaseUrl` comes along because the card now renders coin logos through the
// API's icon proxy.
vi.mock('@/app/lib/api', () => ({ default: { get: apiGet }, apiBaseUrl: '/api/v1' }));
vi.mock('@/app/hooks/useWorkspaceId', () => ({ useWorkspaceId: () => 'ws-1' }));
vi.mock('@/app/i18n', () => ({
  useIntlayer: () => ({
    portfolio: 'Portfolio value',
    sinceYesterday: 'since yesterday',
    asset: 'Asset',
    amount: 'Amount',
    worth: 'Value',
    unrealized: 'Profit',
    // The dashboard's missing-rate notice (#787).
    missingRates: { value: 'No rate for {{currencies}}: counted at face value.' },
    missingRatesAction: 'Set a rate',
  }),
  useLocale: () => ({ locale: 'en' }),
}));
vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

const summaryFor = (income: number, expense: number) => ({
  data: cryptoSummary({
    currency: 'EUR',
    portfolioValue: 5532,
    income,
    expense,
    holdings: [cryptoHolding({ asset: 'ETH', amount: '1', value: 5000 })],
  }),
});

const format = (value: number) => `${value.toFixed(2)} €`;

describe('CryptoPortfolioCard', () => {
  beforeEach(() => {
    apiGet.mockReset();
  });

  it('asks for the dashboard month and shows what came in and went out', async () => {
    apiGet.mockResolvedValue(summaryFor(479.84, 18.23));

    renderWithQuery(<CryptoPortfolioCard formatAmount={format} month="2026-08" monthLabel="August 2026" />);

    expect(await screen.findByText('+479.84 €')).toBeTruthy();
    expect(screen.getByText('−18.23 €')).toBeTruthy();
    expect(screen.getByText('5532.00 €')).toBeTruthy();
    expect(apiGet).toHaveBeenCalledWith(
      '/crypto/summary',
      expect.objectContaining({ params: { month: '2026-08' } }),
    );
  });

  it('says when the figures are USD at face value for want of a rate (#787)', async () => {
    apiGet.mockResolvedValue({ data: { ...summaryFor(0, 0).data, missingRates: ['USD'] } });

    renderWithQuery(<CryptoPortfolioCard formatAmount={format} month="2026-08" monthLabel="August 2026" />);

    expect(await screen.findByRole('status')).toHaveTextContent('USD');
  });

  it('says nothing about rates while the rate is known', async () => {
    apiGet.mockResolvedValue(summaryFor(1, 1));

    renderWithQuery(<CryptoPortfolioCard formatAmount={format} month="2026-08" monthLabel="August 2026" />);

    await screen.findByText('5532.00 €');
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('refetches when the month changes', async () => {
    apiGet.mockResolvedValueOnce(summaryFor(479.84, 18.23));
    apiGet.mockResolvedValueOnce(summaryFor(29.12, 59.88));

    const client = createTestQueryClient();
    const { rerender } = render(
      <CryptoPortfolioCard formatAmount={format} month="2026-08" monthLabel="August 2026" />,
      {
        wrapper: ({ children }) => (
          <QueryClientProvider client={client}>{children}</QueryClientProvider>
        ),
      },
    );
    await screen.findByText('+479.84 €');

    rerender(<CryptoPortfolioCard formatAmount={format} month="2026-07" monthLabel="July 2026" />);

    // The card holds its place while the new month loads instead of vanishing.
    expect(screen.getByText('5532.00 €')).toBeTruthy();
    expect(await screen.findByText('+29.12 €')).toBeTruthy();
    await waitFor(() =>
      expect(apiGet).toHaveBeenLastCalledWith(
        '/crypto/summary',
        expect.objectContaining({ params: { month: '2026-07' } }),
      ),
    );
  });

  it('draws nothing without a wallet, or for a wallet with nothing to show', async () => {
    for (const summary of [
      cryptoSummary({ walletCount: 0 }),
      // Figures left over from a wallet since removed: still nothing to draw.
      cryptoSummary({ walletCount: 0, portfolioValue: 1200, holdings: [cryptoHolding({ asset: 'ETH', amount: '1.5', value: 1200 })] }),
      cryptoSummary({ walletCount: 1 }),
    ]) {
      apiGet.mockResolvedValueOnce({ data: summary });
      const view = renderWithQuery(
        <CryptoPortfolioCard formatAmount={format} month="2026-08" monthLabel="August 2026" />,
      );
      await waitFor(() => expect(apiGet).toHaveBeenCalled());
      await new Promise(resolve => setTimeout(resolve, 0));
      expect(view.container.innerHTML).toBe('');
      view.unmount();
      apiGet.mockReset();
    }
  });

  it.each([
    ['a coin priced at nothing', { holdings: [cryptoHolding({ asset: 'ETH', amount: '1.5', value: 0 })] }],
    ['a coin with no price yet', { unpriced: [{ asset: 'ODD', amount: '100' }] }],
  ])('shows a wallet holding %s', async (_, held) => {
    apiGet.mockResolvedValue({ data: cryptoSummary({ walletCount: 1, ...held }) });

    renderWithQuery(<CryptoPortfolioCard formatAmount={format} month="2026-08" monthLabel="August 2026" />);

    expect(await screen.findByText('August 2026', { exact: false })).toBeTruthy();
  });

  it('shows a past month that has only its closing value', async () => {
    apiGet.mockResolvedValue({ data: cryptoSummary({ currency: 'EUR', portfolioValue: 1200 }) });

    renderWithQuery(<CryptoPortfolioCard formatAmount={format} month="2026-07" monthLabel="July 2026" />);

    expect(await screen.findByText('1200.00 €')).toBeTruthy();
  });

  it('lists each coin with its amount, value and profit, also when sharing a row', async () => {
    apiGet.mockResolvedValue({
      data: cryptoSummary({
        currency: 'EUR',
        portfolioValue: 5532,
        portfolioChangeSinceYesterday: -2.5,
        holdings: [
          cryptoHolding({ asset: 'ETH', amount: '1.5', value: 5000, unrealizedPercent: 12.3 }),
        ],
      }),
    });
    const card = <CryptoPortfolioCard formatAmount={format} month="2026-08" monthLabel="August 2026" />;
    for (const span of [6, 12]) {
      const view = renderWithQuery(<SectionSpanProvider value={span}>{card}</SectionSpanProvider>);
      const table = await screen.findByRole('table');
      expect(table.textContent).toContain('1.5');
      expect(table.textContent).toContain('5000.00 €');
      expect(table.textContent).toContain('+12.3%');
      expect(screen.getByText('−2.5%')).toBeTruthy();
      view.unmount();
    }
  });
});
