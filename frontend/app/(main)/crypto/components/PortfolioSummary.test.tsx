import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { cryptoSummary } from '@/app/test/fixtures/contracts';
import { PortfolioSummary } from './PortfolioSummary';

vi.mock('@/app/components/charts/lazy-charts', () => ({ LazyNetWorthArea: () => null }));

const labels = {
  sinceYesterday: 'since yesterday',
  historyEmpty: 'No history yet',
  unrealized: 'Unrealized',
  costBasis: 'Cost basis',
  income: 'In',
  expense: 'Out',
};
const show = (overrides: Parameters<typeof cryptoSummary>[0] = {}) =>
  render(
    <PortfolioSummary
      summary={cryptoSummary(overrides)}
      history={null}
      labels={labels}
      locale="en"
      money={value => String(value)}
      historyDays={30}
      onHistoryDaysChange={() => undefined}
    />,
  );

/** With no USD rate the values are USD at face value, and the card says so (#787). */
describe('PortfolioSummary and a missing rate', () => {
  it('names USD with the way to set a rate', () => {
    show({ missingRates: ['USD'] });

    expect(screen.getByRole('status')).toHaveTextContent('USD');
  });

  it('says nothing while the rate is known', () => {
    show();

    expect(screen.queryByRole('status')).toBeNull();
  });
});
