// @vitest-environment jsdom
import { act } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { apiResponse } from '@/app/test/api-response';
import { renderHookWithQuery } from '@/app/test/query-wrapper';
import type { PendingPayment, SubscriptionItem } from './useSubscriptionsPage';

const api = vi.hoisted(() => ({ post: vi.fn() }));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
const draft = vi.hoisted(() => ({ clear: vi.fn() }));

vi.mock('@/app/lib/api', () => ({ default: api }));
vi.mock('react-hot-toast', () => ({ default: toast }));
vi.mock('./subscription-draft', () => ({ clearSubscriptionDraft: draft.clear }));
vi.mock('@/app/hooks/useWorkspaceId', () => ({ useWorkspaceId: () => 'ws-1' }));
vi.mock('@/app/i18n', () => ({
  useIntlayer: () => ({
    merged: { value: 'Added to {{vendor}}.' },
    paymentFailed: { value: 'Couldn’t save the payment.' },
  }),
}));

import { useMergeIntoSubscription } from './useMergeIntoSubscription';

const target = { id: 'sub-1', vendorName: 'ACME Cloud Pro' } as SubscriptionItem;
const receipt: PendingPayment = {
  key: 'receipt-2026-10-21',
  date: '2026-10-21',
  amount: 289,
  currency: 'ILS',
  linked: false,
  transactionId: null,
};
const bankRow: PendingPayment = {
  key: 'tx-1',
  date: '2026-09-21',
  amount: 289,
  currency: 'ILS',
  linked: true,
  transactionId: '0b9a6c4e-1f2d-4c3b-9a8e-7d6c5b4a3f21',
};

describe('useMergeIntoSubscription', () => {
  it('records a receipt by its own date, amount and currency, and a bank row by its id', async () => {
    api.post.mockResolvedValue(apiResponse({}));
    const { result } = renderHookWithQuery(() => useMergeIntoSubscription(false));

    let merged = false;
    await act(async () => {
      merged = await result.current.merge(target, [receipt, bankRow]);
    });

    expect(merged).toBe(true);
    expect(api.post).toHaveBeenCalledWith('/subscriptions/sub-1/charges', {
      chargeDate: '2026-10-21',
      amount: 289,
      currency: 'ILS',
    });
    expect(api.post).toHaveBeenCalledWith('/subscriptions/sub-1/charges', {
      transactionId: bankRow.transactionId,
    });
    expect(toast.success).toHaveBeenCalledWith('Added to ACME Cloud Pro.');
    expect(draft.clear).toHaveBeenCalled();
  });

  it('keeps the form when nothing went in, so trying again duplicates nothing', async () => {
    api.post.mockReset().mockRejectedValue(new Error('offline'));
    draft.clear.mockClear();
    const { result } = renderHookWithQuery(() => useMergeIntoSubscription(false));

    let merged = true;
    await act(async () => {
      merged = await result.current.merge(target, [receipt]);
    });

    expect(merged).toBe(false);
    expect(toast.error).toHaveBeenCalled();
    expect(draft.clear).not.toHaveBeenCalled();
  });
});
