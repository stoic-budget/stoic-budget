// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useStatementsFilterState } from './useStatementsFilterState';

const payPeriods = vi.hoisted(() => ({ context: undefined as unknown }));
vi.mock('@/app/hooks/usePayPeriods', () => ({ usePayPeriods: () => payPeriods }));
vi.mock('@/app/hooks/useClearAsOf', () => ({ useClearAsOf: () => () => undefined }));

describe('useStatementsFilterState deep link', () => {
  beforeEach(() => {
    payPeriods.context = undefined;
    localStorage.clear();
  });

  it('opens with only the linked "has" filter', () => {
    const { result } = renderHook(() => useStatementsFilterState({ setPage: () => undefined }));

    act(() => result.current.initFromStorage(null, false, 'warnings'));

    expect(result.current.appliedFilters.has).toEqual(['warnings']);
  });

  it('drops values the list does not know', () => {
    const { result } = renderHook(() => useStatementsFilterState({ setPage: () => undefined }));

    act(() => result.current.initFromStorage(null, false, 'warnings,,bogus'));

    expect(result.current.appliedFilters.has).toEqual(['warnings']);
  });

  it('keeps the "has" filter when the pay period loads after a month link', () => {
    const { result, rerender } = renderHook(() =>
      useStatementsFilterState({ setPage: () => undefined }),
    );

    act(() => result.current.initFromStorage('2026-10', false, 'warnings'));
    payPeriods.context = { monthStart: { kind: 'day', day: 1 } };
    rerender();

    expect(result.current.appliedFilters.has).toEqual(['warnings']);
  });
});
