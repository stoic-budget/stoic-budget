// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import type React from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { LoanSchedule, LoanTermsItem } from '@/app/lib/contracts';
import { LoanTermsCard } from './LoanTermsCard';

vi.mock('@/app/components/versions/ReadOnlyHint', () => ({
  ReadOnlyHint: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock('@/app/i18n', async () => {
  const { autoDictionary, value } = await import(
    '@/app/components/dashboard/__tests__/intlayer-mock'
  );
  return {
    useIntlayer: () =>
      autoDictionary({
        ahead: value('Ahead of plan by {{amount}}'),
        standingHint: value('Every payment counts as debt repaid'),
        unconvertedNote: value('Not in the real balance, no exchange rate: {{list}}'),
      }),
  };
});

const terms: LoanTermsItem = {
  id: 'terms-1',
  walletId: 'wallet-1',
  currency: 'USD',
  principal: '1200.00',
  startDate: '2026-01-10',
  termMonths: 12,
  paymentDay: 10,
  method: 'annuity',
  dayCount: '30/360',
  annualRate: '6.0000',
  rateChanges: [],
  extraPayments: [],
  recurringExtra: null,
  extraMode: 'reduce_term',
  createdAt: '2026-01-10T00:00:00.000Z',
  updatedAt: '2026-01-10T00:00:00.000Z',
};

const summary = { periods: 12, payoffDate: '2027-01-10', totalInterest: 40, totalPaid: 1240, regularPayment: 103.3 };

const schedule = (patch: Partial<LoanSchedule> = {}): LoanSchedule => ({
  currency: 'USD',
  startDate: '2026-01-10',
  principal: 1200,
  today: '2026-02-20',
  unconvertedCurrencies: [],
  plan: { ...summary, rows: [] },
  actual: { balance: 1000, plannedBalance: 1100, difference: -100 },
  projection: null,
  ...patch,
});

const card = (value: LoanSchedule) =>
  render(
    <LoanTermsCard
      terms={terms}
      schedule={value}
      money={amount => `$${amount}`}
      locale="en"
      onEdit={() => {}}
    />,
  );

describe('LoanTermsCard', () => {
  it('says beside the standing how a payment counts against the plan', () => {
    card(schedule());
    expect(screen.getByText('Ahead of plan by $100')).toBeInTheDocument();
    expect(screen.getByText('Every payment counts as debt repaid')).toBeInTheDocument();
  });

  it('names the currencies left out of the real balance', () => {
    card(schedule({ unconvertedCurrencies: ['ZZX', 'ZZY'] }));
    expect(
      screen.getByText('Not in the real balance, no exchange rate: ZZX, ZZY'),
    ).toBeInTheDocument();
  });

  it('has no standing, and no hint, without a real balance', () => {
    card(schedule({ actual: null }));
    expect(screen.queryByText('Every payment counts as debt repaid')).toBeNull();
    expect(screen.queryByText(/no exchange rate/)).toBeNull();
  });
});
