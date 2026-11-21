import { describe, expect, it } from 'vitest';
import { walletItem } from '@/app/test/fixtures/contracts';
import { countsInNetWorth } from './account-types';

describe('countsInNetWorth', () => {
  it('leaves out only an account explicitly set not to count', () => {
    expect(countsInNetWorth(walletItem({ id: 'w-1', name: 'Everyday' }))).toBe(true);
    expect(
      countsInNetWorth(walletItem({ id: 'w-2', name: 'Held for a friend', includeInNetWorth: false })),
    ).toBe(false);
  });

  it('counts an account from a list cached before the setting existed', () => {
    const { includeInNetWorth: _missing, ...cached } = walletItem({ id: 'w-3', name: 'Rainy day' });
    expect(countsInNetWorth(cached as { includeInNetWorth?: boolean })).toBe(true);
  });
});
