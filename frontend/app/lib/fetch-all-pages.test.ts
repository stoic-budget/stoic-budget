import { describe, expect, it } from 'vitest';
import { fetchAllPages } from './fetch-all-pages';

describe('fetchAllPages', () => {
  it('reads every page until the total is reached: 250 rows in pages of 100', async () => {
    const rows = Array.from({ length: 250 }, (_, index) => index);
    const offsets: number[] = [];

    const all = await fetchAllPages(100, async (_page, offset) => {
      offsets.push(offset);
      return { items: rows.slice(offset, offset + 100), total: rows.length };
    });

    expect(all).toHaveLength(250);
    expect(offsets).toEqual([0, 100, 200]);
  });
});
