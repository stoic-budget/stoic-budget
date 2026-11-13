import { describe, expect, it } from 'vitest';
import { walletItem } from '@/app/test/fixtures/contracts';
import { accountToForm, emptyAccountForm } from './useAccounts';

describe('account form', () => {
  it('shows a debt as the positive amount owed', () => {
    const card = walletItem({ id: 'w-card', name: 'ACME Card', type: 'credit_card', initialBalance: '-250.00' });
    expect(accountToForm(card).openingBalance).toBe('250');
  });

  it('leaves a zero opening balance empty', () => {
    expect(accountToForm(walletItem({ id: 'w-1', name: 'Everyday' })).openingBalance).toBe('');
    expect(emptyAccountForm('EUR')).toMatchObject({ type: 'checking', currency: 'EUR' });
  });

  it('opens a cached account without the setting as counted, so saving keeps it counted', () => {
    const { includeInNetWorth: _missing, ...cached } = walletItem({ id: 'w-1', name: 'Everyday' });
    expect(accountToForm(cached as ReturnType<typeof walletItem>).includeInNetWorth).toBe(true);
    const heldForAFriend = walletItem({ id: 'w-2', name: 'Held', includeInNetWorth: false });
    expect(accountToForm(heldForAFriend).includeInNetWorth).toBe(false);
  });
});
