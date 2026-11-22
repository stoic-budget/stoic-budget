import { describe, expect, it } from 'vitest';
import type { GoalAccount, WalletItem } from '@/app/lib/contracts';
import { fillSlots, followableAccounts, followsAccount } from './goal-account';

const ME = 'member-1';
const THEM = 'member-2';

function account(overrides: Partial<WalletItem>): WalletItem {
  return {
    id: 'shared',
    name: 'ACME Savings',
    currency: 'EUR',
    isActive: true,
    ownerMemberId: null,
    ...overrides,
  } as WalletItem;
}

const linked = (overrides: Partial<GoalAccount> = {}): GoalAccount => ({
  id: 'theirs',
  name: 'Member Two Pocket',
  currency: 'EUR',
  balance: 10,
  status: 'following',
  ...overrides,
});

describe('followableAccounts', () => {
  const accounts = [
    account({}),
    account({ id: 'mine', ownerMemberId: ME }),
    account({ id: 'theirs', ownerMemberId: THEM }),
    account({ id: 'archived', isActive: false }),
  ];

  it("offers active shared accounts and the viewer's own, never another member's", () => {
    expect(followableAccounts(accounts, ME, true, null).map(row => row.id)).toEqual([
      'shared',
      'mine',
    ]);
  });

  it('offers every active account in a workspace of one', () => {
    expect(followableAccounts(accounts, null, false, null).map(row => row.id)).toEqual([
      'shared',
      'mine',
      'theirs',
    ]);
  });

  it('keeps the account the goal already follows, so the form shows what is saved', () => {
    expect(followableAccounts(accounts, ME, true, linked()).map(row => row.id)).toContain('theirs');
  });
});

describe('followsAccount', () => {
  it('is true while following, also without a rate, and false once archived or unlinked', () => {
    expect(followsAccount({ account: linked() })).toBe(true);
    expect(followsAccount({ account: linked({ status: 'no_rate' }) })).toBe(true);
    expect(followsAccount({ account: linked({ status: 'archived' }) })).toBe(false);
    expect(followsAccount({ account: null })).toBe(false);
  });
});

describe('fillSlots', () => {
  it('puts an account name in literally, replacement patterns and all', () => {
    expect(fillSlots('Follows {{account}}', { account: 'ACME $& Co' })).toBe('Follows ACME $& Co');
  });
});
