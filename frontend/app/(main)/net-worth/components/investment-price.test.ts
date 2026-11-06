import { describe, expect, it } from 'vitest';
import { isStaleQuote } from './investment-price';

describe('isStaleQuote', () => {
  const now = new Date('2026-10-10T00:00:00Z');

  it('flags an automatic quote that stopped moving', () => {
    expect(isStaleQuote({ priceSource: 'auto', pricedAt: '2026-10-06T00:00:00Z' }, now)).toBe(true);
  });

  it('leaves a recent quote alone', () => {
    expect(isStaleQuote({ priceSource: 'auto', pricedAt: '2026-10-08T00:00:00Z' }, now)).toBe(false);
  });

  it('never flags a price typed by hand, which says so itself', () => {
    expect(isStaleQuote({ priceSource: 'manual', pricedAt: '2026-01-01T00:00:00Z' }, now)).toBe(false);
  });
});
