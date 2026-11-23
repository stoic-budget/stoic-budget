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
    apiQueryDecoded.mockResolvedValue({ rate: 3.67 });
    expect(await fetchExchangeRate('USD', 'AED')).toBe(3.67);
  });

  it('answers no rate when the server has none, asking no third party (#646)', async () => {
    apiQueryDecoded.mockRejectedValue(new Error('no rate'));

    expect(await fetchExchangeRate('AED', 'ILS')).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });
});
