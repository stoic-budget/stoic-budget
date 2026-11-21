import { describe, expect, it } from 'vitest';
import {
  amountOf,
  EMPTY_FILTERS,
  filtersFromParams,
  filtersKey,
  filtersToQuery,
  hasFilters,
  type TransactionFilters,
  withFilters,
} from './transaction-filters';

const categoryOne = '7d0f3a52-1c4e-4b8a-9f00-2a6c1b9d4e11';
const categoryTwo = '0b6e2f1c-8d3a-4c5e-9a7b-1f2e3d4c5b6a';
const tagOne = '4c1d9e2a-3b5f-4a6c-8d7e-9f0a1b2c3d4e';

const full: TransactionFilters = {
  q: 'ACME Store',
  amountMin: 10,
  amountMax: 99.5,
  categoryIds: [categoryOne, categoryTwo],
  tagIds: [tagOne],
  uncategorized: true,
  untagged: true,
  noPayee: true,
  paymentType: 'card',
};

describe('transaction filters in the URL', () => {
  it('reads back exactly what it wrote, so a link reproduces the view', () => {
    const params = withFilters(new URLSearchParams(), full);
    expect(filtersFromParams(params)).toEqual(full);
  });

  it('keeps the period and replaces only its own keys', () => {
    const params = withFilters(
      new URLSearchParams(`month=2026-06&q=old&tagIds=${tagOne}`),
      { ...EMPTY_FILTERS, q: 'new' },
    );
    expect(params.get('month')).toBe('2026-06');
    expect(params.get('q')).toBe('new');
    expect(params.has('tagIds')).toBe(false);
  });

  it('writes nothing for empty filters', () => {
    expect(withFilters(new URLSearchParams('all=1'), EMPTY_FILTERS).toString()).toBe('all=1');
    expect(hasFilters(EMPTY_FILTERS)).toBe(false);
    expect(hasFilters({ ...EMPTY_FILTERS, untagged: true })).toBe(true);
  });

  it('drops what the API would refuse: bad ids, negative or non-numeric amounts, odd toggles', () => {
    const filters = filtersFromParams(
      new URLSearchParams(
        `q=%20%20&amountMin=-3&amountMax=lots&categoryIds=${categoryOne},nope,${categoryOne}&tagIds=42&uncategorized=yes&paymentType=cash`,
      ),
    );
    expect(filters).toEqual({ ...EMPTY_FILTERS, categoryIds: [categoryOne] });
  });

  it('reads a decimal comma as a point', () => {
    expect(amountOf('12,5')).toBe(12.5);
    expect(amountOf('')).toBeUndefined();
    expect(amountOf('0')).toBe(0);
  });

  it('reads thousands grouped the way each locale types them', () => {
    expect(amountOf('1,000')).toBe(1000);
    expect(amountOf('1.000')).toBe(1000);
    expect(amountOf('1 000')).toBe(1000);
    expect(amountOf('1\u00a0000,50')).toBe(1000.5);
    expect(amountOf('1,000.50')).toBe(1000.5);
    expect(filtersFromParams(new URLSearchParams('amountMin=1,000')).amountMin).toBe(1000);
  });

  it('gives one key per filter set, whatever the order it was built in', () => {
    expect(filtersKey({ ...full, tagIds: [tagOne] })).toBe(filtersKey(full));
    expect(filtersKey(EMPTY_FILTERS)).toBe('');
  });
});

describe('filtersToQuery', () => {
  it('joins the lists and sends toggles only when on', () => {
    expect(filtersToQuery(full)).toEqual({
      q: 'ACME Store',
      amountMin: 10,
      amountMax: 99.5,
      categoryIds: `${categoryOne},${categoryTwo}`,
      tagIds: tagOne,
      uncategorized: true,
      untagged: true,
      noPayee: true,
      paymentType: 'card',
    });
    expect(Object.values(filtersToQuery(EMPTY_FILTERS)).filter(v => v !== undefined)).toEqual([]);
  });
});
