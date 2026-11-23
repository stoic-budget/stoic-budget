// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Payable } from '@/app/lib/payables-api';
import { useRecordPayment } from './useRecordPayment';

const api = vi.hoisted(() => ({ addPayment: vi.fn(), markAsPaid: vi.fn(), bookPayment: vi.fn() }));
vi.mock('@/app/lib/payables-api', () => ({ payablesApi: api }));
vi.mock('react-hot-toast', () => ({ default: { error: vi.fn() } }));

describe('useRecordPayment', () => {
  it('records the payment once when Confirm is clicked twice before the first answer', async () => {
    let answer: (payable: Payable) => void = () => {};
    api.addPayment.mockImplementation(
      () => new Promise<Payable>(resolve => (answer = resolve)),
    );
    const setPayingPayable = vi.fn();
    const reload = vi.fn(async () => undefined);
    const { result } = renderHook(() => useRecordPayment(setPayingPayable, reload, 'Failed'));
    const bill = { id: 'bill-1' } as Payable;
    const partial = { kind: 'payment', payload: { amount: 400 } } as never;

    let first: Promise<void> = Promise.resolve();
    act(() => {
      first = result.current.confirm(bill, partial);
      void result.current.confirm(bill, partial);
    });
    expect(result.current.paying).toBe(true);

    await act(async () => {
      answer({ id: 'bill-1', status: 'partially_paid' } as Payable);
      await first;
    });

    expect(api.addPayment).toHaveBeenCalledTimes(1);
    expect(reload).toHaveBeenCalledTimes(1);
    expect(result.current.paying).toBe(false);
  });
});
