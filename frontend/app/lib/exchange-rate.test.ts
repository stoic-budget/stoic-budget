import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiQueryDecoded = vi.hoisted(() => vi.fn());
vi.mock('@/app/lib/query-fn-schema', () => ({ apiQueryDecoded }));

import { fetchExchangeRate } from './exchange-rate';

describe('fetchExchangeRate', () => {
  beforeEach(() => {
    apiQueryDecoded.mockReset();
    vi.stubGlobal('fetch', vi.fn());
  });

  it("answers the server's rate", async () => {
    apiQueryDecoded.mockResolvedValue({ rate: 3.67, missing: false });
    expect(await fetchExchangeRate('USD', 'AED')).toBe(3.67);
  });

  it("answers no rate for the server's missing answer, not its placeholder 1", async () => {
    apiQueryDecoded.mockResolvedValue({
      from: 'AED',
      to: 'ILS',
      rate: 1,
      date: null,
      rateDate: null,
      stale: false,
      missing: true,
    });
    expect(await fetchExchangeRate('AED', 'ILS')).toBeNull();
  });

  it('answers no rate when the request fails, asking no third party (#646)', async () => {
    apiQueryDecoded.mockRejectedValue(new Error('no rate'));

    expect(await fetchExchangeRate('AED', 'ILS')).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });
});
