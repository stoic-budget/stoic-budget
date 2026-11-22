// @vitest-environment jsdom
import { act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearManualPrefill,
  DUPLICATE_EXPENSE_HREF,
  peekManualPrefill,
} from '@/app/lib/manual-expense-prefill';
import { walletItem } from '@/app/test/fixtures/contracts';
import { renderHookWithQuery } from '@/app/test/query-wrapper';
import type { Transaction } from '../types';
import { useDuplicateTransaction } from './useDuplicateTransaction';

const api = vi.hoisted(() => ({ get: vi.fn() }));
const router = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock('@/app/lib/api', () => ({ default: api, apiBaseUrl: '/api/v1' }));
vi.mock('@/app/hooks/useWorkspaceId', () => ({ useWorkspaceId: () => 'ws-1' }));
vi.mock('next/navigation', () => ({ useRouter: () => router }));

const ROW: Transaction = {
  id: 'tx-1',
  transactionDate: '2026-10-12',
  counterpartyName: 'ACME Store - Wireless Buds',
  paymentPurpose: 'Order 1042',
  debit: 12.5,
  credit: 0,
  amount: -12.5,
  transactionType: 'expense',
  currency: 'USD',
};
const ACCOUNT = walletItem({ id: '11111111-1111-4111-8111-111111111111', name: 'Everyday' });

/** The accounts answer, held until the test lets it through. */
function heldAccounts() {
  let release: () => void = () => undefined;
  api.get.mockReset().mockReturnValue(
    new Promise(resolve => {
      release = () => resolve({ data: [ACCOUNT] });
    }),
  );
  return () => release();
}

describe('useDuplicateTransaction', () => {
  beforeEach(() => {
    router.push.mockReset();
    window.history.replaceState(null, '', '/statements/transactions');
  });
  afterEach(() => clearManualPrefill());

  it('goes to the form once the accounts are read', async () => {
    const release = heldAccounts();
    const { result } = renderHookWithQuery(() => useDuplicateTransaction([]));

    let opened: Promise<boolean> = Promise.resolve(false);
    act(() => {
      opened = result.current(ROW);
    });
    release();

    await expect(opened).resolves.toBe(true);
    expect(router.push).toHaveBeenCalledWith(DUPLICATE_EXPENSE_HREF);
    expect(peekManualPrefill()?.walletId).toBeUndefined();
  });

  it('does nothing when the place it was asked from closed before the accounts came', async () => {
    const release = heldAccounts();
    const { result, unmount } = renderHookWithQuery(() => useDuplicateTransaction([]));

    const opened = result.current(ROW);
    unmount();
    release();

    await expect(opened).resolves.toBe(false);
    expect(router.push).not.toHaveBeenCalled();
    expect(peekManualPrefill()).toBeNull();
  });

  it('does nothing when the person moved to another page meanwhile', async () => {
    const release = heldAccounts();
    const { result } = renderHookWithQuery(() => useDuplicateTransaction([]));

    const opened = result.current(ROW);
    window.history.pushState(null, '', '/budgets');
    release();

    await expect(opened).resolves.toBe(false);
    expect(router.push).not.toHaveBeenCalled();
    expect(peekManualPrefill()).toBeNull();
  });

  it('ignores a second click while the first is under way', async () => {
    const release = heldAccounts();
    const { result } = renderHookWithQuery(() => useDuplicateTransaction([]));

    const first = result.current(ROW);
    const second = result.current(ROW);
    release();

    await expect(second).resolves.toBe(false);
    await expect(first).resolves.toBe(true);
    expect(router.push).toHaveBeenCalledTimes(1);
  });
});
