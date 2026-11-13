// @vitest-environment jsdom
import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { apiResponse } from '@/app/test/api-response';

const api = vi.hoisted(() => ({ post: vi.fn() }));

vi.mock('@/app/lib/api', () => ({ default: api }));

import { useCurrencyConversion } from './useCurrencyConversion';

describe('useCurrencyConversion', () => {
  it("converts each record at its own day's rate and leaves out a currency with no rate", async () => {
    const early = { currencyValue: 'ILS', dateValue: '2026-10-03' };
    const late = { currencyValue: 'ILS', dateValue: '2026-10-16T00:00:00.000Z' };
    const unknown = { currencyValue: 'XTS', dateValue: '2026-10-16' };
    const rateOn = { '2026-10-03': 0.26, '2026-10-16': 0.32 };
    // One answer per pair, in the order the hook sends them (sorted by currency, then day).
    api.post.mockResolvedValue(
      apiResponse({
        targetCurrency: 'USD',
        results: [
          { converted: rateOn['2026-10-03'], rate: rateOn['2026-10-03'], source: 'test', missing: false },
          { converted: rateOn['2026-10-16'], rate: rateOn['2026-10-16'], source: 'test', missing: false },
          { converted: 1, rate: 1, source: 'test', missing: true },
        ],
      }),
    );

    const { result } = renderHook(() => useCurrencyConversion([early, late, unknown], 'USD'));

    await waitFor(() => expect(result.current.convert(100, 'ILS', early.dateValue)).toBe(100 * rateOn['2026-10-03']));
    expect(result.current.convert(100, 'ILS', late.dateValue)).toBe(100 * rateOn['2026-10-16']);
    expect(result.current.convert(100, 'XTS', unknown.dateValue)).toBe(0);
    expect(result.current.convert(100, 'USD', late.dateValue)).toBe(100);
    expect(api.post).toHaveBeenCalledWith('/exchange-rates/convert', {
      targetCurrency: 'USD',
      items: [
        { amount: 1, currency: 'ILS', date: '2026-10-03' },
        { amount: 1, currency: 'ILS', date: '2026-10-16' },
        { amount: 1, currency: 'XTS', date: '2026-10-16' },
      ],
    });
  });

  it('asks for the latest rate for a date typed in another shape, so one bad date breaks nothing', async () => {
    const typed = { currencyValue: 'EUR', dateValue: '13/10/2026' };
    const rate = 1.1;
    api.post.mockResolvedValue(
      apiResponse({
        targetCurrency: 'USD',
        results: [{ converted: rate, rate, source: 'test', missing: false }],
      }),
    );

    const { result } = renderHook(() => useCurrencyConversion([typed], 'USD'));

    await waitFor(() => expect(result.current.convert(10, 'EUR', typed.dateValue)).toBe(10 * rate));
    expect(api.post).toHaveBeenLastCalledWith('/exchange-rates/convert', {
      targetCurrency: 'USD',
      items: [{ amount: 1, currency: 'EUR', date: null }],
    });
  });
});
