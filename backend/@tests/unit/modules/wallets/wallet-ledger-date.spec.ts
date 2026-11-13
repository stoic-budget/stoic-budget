import { afterEach, describe, expect, it } from 'vitest';
import { toDateOnly } from '../../../../src/modules/wallets/wallet-ledger';

const originalTz = process.env.TZ;

describe('toDateOnly', () => {
  afterEach(() => {
    process.env.TZ = originalTz;
  });

  it('keeps the calendar day of a date column read east of UTC', () => {
    process.env.TZ = 'Asia/Tokyo';
    // The pg driver hands a `date` column back as local midnight.
    const localMidnight = new Date(2026, 0, 15);
    expect(toDateOnly(localMidnight)).toBe('2026-01-15');
  });

  it('keeps the calendar day of a date column read west of UTC', () => {
    process.env.TZ = 'America/Los_Angeles';
    expect(toDateOnly(new Date(2026, 2, 1))).toBe('2026-03-01');
  });

  it('takes the day from a string as written', () => {
    expect(toDateOnly('2026-11-13')).toBe('2026-11-13');
    expect(toDateOnly('2026-11-13T23:30:00Z')).toBe('2026-11-13');
    expect(toDateOnly('13.11.2026')).toBeNull();
    expect(toDateOnly(null)).toBeNull();
  });
});
