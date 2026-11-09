import { describe, expect, it } from 'vitest';
import { periodBounds, periodOf } from '@/app/lib/contracts/workspaces/pay-period';
import {
  PERIOD_OF_VECTORS,
  PERIOD_VECTORS,
} from '@/app/lib/contracts/workspaces/pay-period-vectors';

/** The same vectors the backend runs: both copies of the library agree. */
describe('periodBounds (shared vectors)', () => {
  it.each(PERIOD_VECTORS.map(vector => [vector.name, vector] as const))('%s', (_name, vector) => {
    expect(periodBounds(vector.context, vector.month)).toEqual({
      from: vector.from,
      to: vector.to,
    });
  });
});

describe('periodOf (shared vectors)', () => {
  it.each(PERIOD_OF_VECTORS.map(vector => [vector.name, vector] as const))('%s', (_name, vector) => {
    expect(periodOf(vector.context, vector.date)).toBe(vector.month);
  });
});
