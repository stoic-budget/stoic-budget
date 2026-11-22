// @vitest-environment jsdom
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import type React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { LoanPaymentItem, LoanPayments } from '@/app/lib/contracts';
import { renderWithQuery } from '@/app/test/query-wrapper';
import { LoanPaymentsCard } from './LoanPaymentsCard';
import { interestFrom, paymentState } from './loan-payment-split';

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), delete: vi.fn() }));

vi.mock('@/app/lib/api', () => ({ default: api }));
vi.mock('@/app/hooks/useWorkspaceId', () => ({ useWorkspaceId: () => 'ws-1' }));
vi.mock('@/app/lib/invalidate-document-lists', () => ({ invalidateFinancialData: vi.fn() }));
vi.mock('@/app/components/versions/ReadOnlyHint', () => ({
  ReadOnlyHint: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock('@/app/i18n', async () => {
  const { autoDictionary, value } = await import(
    '@/app/components/dashboard/__tests__/intlayer-mock'
  );
  return {
    useLocale: () => ({ locale: 'en' }),
    useIntlayer: () =>
      autoDictionary({
        split: value('Split'),
        rejoin: value('Join back'),
        cancel: value('Cancel'),
        interest: value('Interest'),
        suggested: value('Suggested {{interest}} + {{principal}}'),
        splitInfo: value('Split {{interest}} + {{principal}}'),
        blockedCurrency: value('Other currency'),
        inReview: value('In Review'),
      }),
  };
});

const item = (patch: Partial<LoanPaymentItem> & Pick<LoanPaymentItem, 'transactionId'>) => ({
  date: '2026-02-15',
  amount: 1032.8,
  currency: 'EUR',
  counterpartyName: 'ACME Bank - Loan payment',
  fromWallet: { id: 'w-checking', name: 'Everyday' },
  isVerified: true,
  split: null,
  suggestion: { period: 1, scheduledPayment: 1032.8, interest: 60, principal: 972.8 },
  blocked: null,
  ...patch,
});

const list = (items: LoanPaymentItem[]): LoanPayments => ({
  currency: 'EUR',
  autoSplit: false,
  items,
  totals: { interest: 0, principal: 0, unsplit: items.length },
});

function renderCard(payments: LoanPayments) {
  api.get.mockResolvedValue({ data: payments });
  renderWithQuery(
    <LoanPaymentsCard walletId="w-loan" money={value => value.toFixed(2)} locale="en" />,
  );
}

describe('LoanPaymentsCard', () => {
  beforeEach(() => {
    api.get.mockReset();
    api.post.mockReset();
    api.delete.mockReset();
  });

  it('splits a payment with the schedule’s interest, as typed', async () => {
    const payment = item({ transactionId: 'p-1' });
    renderCard(list([payment]));
    expect(await screen.findByText('Suggested 60.00 + 972.80')).toBeInTheDocument();
    api.post.mockResolvedValue({
      data: { ...payment, split: { interestTransactionId: 'i-1', interest: 55.5, principal: 977.3 } },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Split' }));
    const dialog = await screen.findByRole('dialog');
    const field = within(dialog).getByLabelText('Interest');
    expect(field).toHaveValue('60');
    fireEvent.change(field, { target: { value: '55,5' } });
    expect(within(dialog).getByText('977.30')).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Split' }));

    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith('/wallets/w-loan/loan-payments/p-1/split', {
        interest: 55.5,
      }),
    );
  });

  it('joins a split payment back, and offers no split where it cannot', async () => {
    renderCard(
      list([
        item({
          transactionId: 'p-1',
          split: { interestTransactionId: 'i-1', interest: 60, principal: 972.8 },
        }),
        item({ transactionId: 'p-2', blocked: 'other_currency', suggestion: null, isVerified: false }),
      ]),
    );
    expect(await screen.findByText('Split 60.00 + 972.80')).toBeInTheDocument();
    expect(screen.getByText('Other currency · In Review')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Split' })).toBeDisabled();
    api.delete.mockResolvedValue({ data: { message: 'ok' } });

    fireEvent.click(screen.getByRole('button', { name: 'Join back' }));
    await waitFor(() =>
      expect(api.delete).toHaveBeenCalledWith('/wallets/w-loan/loan-payments/p-1/split'),
    );
  });
});

describe('loan payment split helpers', () => {
  it('takes an interest of a cent up to the payment, with a comma or a point', () => {
    expect(interestFrom('55,5', 100)).toBe(55.5);
    expect(interestFrom('100', 100)).toBe(100);
    expect(interestFrom('100.01', 100)).toBeNull();
    expect(interestFrom('0', 100)).toBeNull();
    expect(interestFrom('1.234', 100)).toBeNull();
    expect(interestFrom('', 100)).toBeNull();
  });

  it('says a payment no period took is all principal', () => {
    expect(
      paymentState(
        item({
          transactionId: 'p-3',
          suggestion: { period: null, scheduledPayment: null, interest: 0, principal: 300 },
        }),
      ),
    ).toEqual({ kind: 'extra' });
  });
});
