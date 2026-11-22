import { DEMO_RECEIPTS } from '@/modules/workspaces/demo-workspace/public-demo/demo-receipts.data';

describe('DEMO_RECEIPTS', () => {
  it('names each receipt once, so each gets its own file', () => {
    const keys = DEMO_RECEIPTS.map(receipt => receipt.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const key of keys) expect(key).toMatch(/^[a-z0-9-]+$/);
  });

  it('adds the lines up to the total each receipt prints', () => {
    for (const receipt of DEMO_RECEIPTS) {
      const lines = receipt.lines.reduce((sum, line) => sum + line.cents, 0);
      expect({ key: receipt.key, cents: lines }).toEqual({
        key: receipt.key,
        cents: receipt.totalCents,
      });
    }
  });

  it('keeps every date inside the demo year and the tax below the total', () => {
    for (const receipt of DEMO_RECEIPTS) {
      expect(receipt.daysBeforeAnchor).toBeGreaterThanOrEqual(0);
      expect(receipt.daysBeforeAnchor).toBeLessThan(365);
      if (receipt.taxCents !== null) expect(receipt.taxCents).toBeLessThan(receipt.totalCents);
    }
  });

  it('fetches only Wikimedia originals, pinned by checksum, with their credit', () => {
    for (const receipt of DEMO_RECEIPTS) {
      expect(receipt.url.startsWith('https://upload.wikimedia.org/wikipedia/commons/')).toBe(true);
      expect(receipt.page.startsWith('https://commons.wikimedia.org/wiki/File:')).toBe(true);
      expect(receipt.sha1).toMatch(/^[0-9a-f]{40}$/);
      expect(receipt.author.trim()).not.toBe('');
    }
  });
});
