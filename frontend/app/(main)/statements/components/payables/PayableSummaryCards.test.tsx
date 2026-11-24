import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { PayablesSummary } from '@/app/lib/payables-api';
import PayableSummaryCards from './PayableSummaryCards';

const labels = {
  toPay: 'To pay',
  overdue: 'Overdue',
  dueThisWeek: 'Due this week',
  paidTotal: 'Paid',
  itemsSuffix: 'bills',
  convertedNote: 'In {currency}, converted from {currencies}',
};
const summary = (overrides: Partial<PayablesSummary> = {}): PayablesSummary => ({
  toPay: 10,
  overdue: 0,
  dueThisWeek: 10,
  paidThisMonth: 0,
  paidTotal: 0,
  toPayCount: 1,
  overdueCount: 0,
  paidTotalCount: 0,
  dueThisWeekCount: 1,
  unbookedTotal: 0,
  unbookedCount: 0,
  convertedCurrencies: [],
  ...overrides,
});

/** A bill in a currency with no rate counts at face value, and the cards say so (#787). */
describe('PayableSummaryCards and missing rates', () => {
  it('names the currencies counted at face value, with the way to set a rate', () => {
    render(<PayableSummaryCards summary={summary({ missingRates: ['XTS'] })} currency="EUR" labels={labels} />);

    expect(screen.getByRole('status')).toHaveTextContent('XTS');
    expect(screen.getByRole('link')).toHaveAttribute(
      'href',
      '/settings/profile?tab=data&section=exchange-rates',
    );
  });

  it('says nothing about rates when every bill had one', () => {
    render(<PayableSummaryCards summary={summary()} currency="EUR" labels={labels} />);

    expect(screen.queryByRole('status')).toBeNull();
  });
});
