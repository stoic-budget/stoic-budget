// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { PendingPayment, SubscriptionItem } from '../hooks/useSubscriptionsPage';

const hook = vi.hoisted(() => ({
  subscriptions: [] as SubscriptionItem[],
  merge: vi.fn(async () => true),
}));

vi.mock('../hooks/useMergeIntoSubscription', () => ({
  useMergeIntoSubscription: () => ({
    subscriptions: hook.subscriptions,
    loading: false,
    merging: false,
    merge: hook.merge,
  }),
}));
vi.mock('@/app/components/ui/drawer-shell', () => ({
  DrawerShell: ({ isOpen, children }: { isOpen: boolean; children: React.ReactNode }) =>
    isOpen ? <div data-testid="merge-drawer">{children}</div> : null,
}));
vi.mock('@/app/components/VendorIcon', () => ({ VendorIcon: () => <span /> }));
const value = (text: string) => ({ value: text, toString: () => text });
vi.mock('@/app/i18n', () => ({
  useIntlayer: () => ({
    mergeWith: 'Merge with an existing subscription',
    title: 'Merge with',
    hint: 'Hint',
    search: value('Search subscriptions'),
    empty: 'No subscriptions to merge with yet.',
    cancel: value('Cancel'),
    monthly: 'Monthly',
  }),
}));

import { MergeIntoSubscription } from './MergeIntoSubscription';

const subscription = (vendorName: string, over: Partial<SubscriptionItem> = {}) =>
  ({
    id: `sub-${vendorName}`,
    vendorName,
    vendorDomain: null,
    amount: 10,
    currency: 'USD',
    frequency: 'monthly',
    status: 'active',
    nextChargeDate: null,
    ...over,
  }) as SubscriptionItem;

const receiptPayment: PendingPayment = {
  key: 'receipt-2026-10-21',
  date: '2026-10-21',
  amount: 289,
  currency: 'ILS',
  linked: false,
  transactionId: null,
};

describe('MergeIntoSubscription', () => {
  it('offers nothing while the new subscription has no payment', () => {
    render(<MergeIntoSubscription payments={[]} vendorName="ACME Cloud" onMerged={vi.fn()} />);

    expect(screen.queryByText('Merge with an existing subscription')).toBeNull();
  });

  it('lists kept subscriptions, a like name first and cancelled ones left out, and merges into the one picked', async () => {
    hook.subscriptions = [
      subscription('Beta Music'),
      subscription('ACME Cloud Pro'),
      subscription('Old Service', { status: 'cancelled' }),
    ];
    const onMerged = vi.fn();
    render(
      <MergeIntoSubscription payments={[receiptPayment]} vendorName="ACME Cloud" onMerged={onMerged} />,
    );

    fireEvent.click(screen.getByText('Merge with an existing subscription'));
    const names = screen.getAllByRole('button').map(button => button.textContent ?? '');
    const listed = names.filter(name => /ACME|Beta|Old/.test(name));
    expect(listed.map(name => name.split('10 USD')[0])).toEqual(['ACME Cloud Pro', 'Beta Music']);

    fireEvent.click(screen.getByText('ACME Cloud Pro'));

    await waitFor(() => expect(onMerged).toHaveBeenCalled());
    expect(hook.merge).toHaveBeenCalledWith(hook.subscriptions[1], [receiptPayment]);
    expect(screen.queryByTestId('merge-drawer')).toBeNull();
  });
});
