import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const query = vi.hoisted(() => ({ decoded: vi.fn() }));

vi.mock('@/app/lib/query-fn-schema', () => ({ apiQueryDecoded: query.decoded }));

/** The store reads localStorage once, when the module loads: a fresh copy per case. */
async function loadFresh(): Promise<typeof import('./useDemoStatus')> {
  vi.resetModules();
  return import('./useDemoStatus');
}

describe('useDemoStatus', () => {
  beforeEach(() => {
    query.decoded.mockReset();
    localStorage.clear();
  });

  it('does not trust a stored demo answer when the server does not answer', async () => {
    localStorage.setItem('demo-status', JSON.stringify({ enabled: true }));
    query.decoded.mockRejectedValue(new Error('Network Error'));
    const demo = await loadFresh();
    // Known from storage before the request settles.
    expect(demo.isDemoInstance()).toBe(true);

    const { result } = renderHook(() => demo.useDemoStatus());

    await waitFor(() => expect(result.current).toEqual({ enabled: false, account: null }));
    expect(demo.isDemoInstance()).toBe(false);
    expect(query.decoded).toHaveBeenCalledTimes(1);
  });

  it('keeps a demo answer the server gives', async () => {
    query.decoded.mockResolvedValue({ enabled: true, account: null });
    const demo = await loadFresh();

    const { result } = renderHook(() => demo.useDemoStatus());

    await waitFor(() => expect(result.current?.enabled).toBe(true));
    expect(demo.isDemoInstance()).toBe(true);
  });
});
