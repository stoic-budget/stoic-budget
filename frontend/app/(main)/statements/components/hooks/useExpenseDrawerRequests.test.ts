// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import type { ReadonlyURLSearchParams } from 'next/navigation';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  clearManualPrefill,
  peekManualPrefill,
  stashManualPrefill,
} from '@/app/lib/manual-expense-prefill';
import {
  createDefaultManualDraft,
  STATEMENTS_OPEN_EXPENSE_DRAWER_EVENT,
} from '@/app/lib/statement-expense-drawer';
import { useExpenseDrawerRequests } from './useExpenseDrawerRequests';

const DRAFT = { ...createDefaultManualDraft('EUR'), amount: '12.5', merchant: 'ACME Store' };

function open(query: string) {
  const router = { replace: vi.fn() };
  const searchParams = new URLSearchParams(query) as unknown as ReadonlyURLSearchParams;
  const hook = renderHook(() =>
    useExpenseDrawerRequests({ router: router as never, searchParams }),
  );
  return { router, hook };
}

describe('useExpenseDrawerRequests and a duplicated draft', () => {
  afterEach(() => clearManualPrefill());

  it('keeps the draft for a link marked duplicate=1, and drops the marker from the URL', () => {
    stashManualPrefill(DRAFT);
    const { router, hook } = open('openExpenseDrawer=manual&duplicate=1');

    expect(hook.result.current.expenseDrawerOpen).toBe(true);
    expect(peekManualPrefill()).toEqual(DRAFT);
    expect(router.replace).toHaveBeenCalledWith('/statements/submit');
  });

  it('drops a left-over draft when the form is opened any other way', () => {
    stashManualPrefill(DRAFT);
    open('openExpenseDrawer=manual');

    expect(peekManualPrefill()).toBeNull();
  });

  it('drops a left-over draft when the form is opened by the event', () => {
    open('');
    stashManualPrefill(DRAFT);
    act(() => {
      window.dispatchEvent(
        new CustomEvent(STATEMENTS_OPEN_EXPENSE_DRAWER_EVENT, { detail: { mode: 'manual' } }),
      );
    });

    expect(peekManualPrefill()).toBeNull();
  });

  it('drops the draft when the form closes', () => {
    stashManualPrefill(DRAFT);
    const { hook } = open('openExpenseDrawer=manual&duplicate=1');

    act(() => hook.result.current.setExpenseDrawerOpen(false));

    expect(peekManualPrefill()).toBeNull();
  });

  it('drops the draft when the page goes away with the form open', () => {
    stashManualPrefill(DRAFT);
    const { hook } = open('openExpenseDrawer=manual&duplicate=1');

    hook.unmount();

    expect(peekManualPrefill()).toBeNull();
  });
});
