'use client';

import { Button, TextField } from '@mui/material';
import { useMemo, useState } from 'react';
import { ChevronLeft } from '@/app/components/icons';
import { DrawerShell } from '@/app/components/ui/drawer-shell';
import { VendorIcon } from '@/app/components/VendorIcon';
import { useIntlayer } from '@/app/i18n';
import { formatStoredDateWithOptions, formatWholeNumber } from '@/app/lib/user-format-store';
import { useMergeIntoSubscription } from '../hooks/useMergeIntoSubscription';
import type { PendingPayment, SubscriptionItem } from '../hooks/useSubscriptionsPage';

interface MergeIntoSubscriptionProps {
  /** The payments of the subscription being added, a receipt's among them. */
  payments: PendingPayment[];
  /** What the new one is called: subscriptions of a like name are listed first. */
  vendorName: string;
  /** The payments went to another subscription: the add form has nothing left to do. */
  onMerged: () => void;
}

const sameName = (vendorName: string, name: string): boolean => {
  const a = vendorName.trim().toLowerCase();
  const b = name.trim().toLowerCase();
  return a.length > 0 && (a.includes(b) || b.includes(a));
};

/**
 * "Merge with an existing subscription" under a new one's payments: a smaller
 * drawer lists the subscriptions already kept, by icon and name, and picking
 * one records the payments on it instead of adding a second subscription.
 */
export function MergeIntoSubscription({
  payments,
  vendorName,
  onMerged,
}: MergeIntoSubscriptionProps): React.JSX.Element | null {
  const t = useIntlayer('mergeIntoSubscription');
  const page = useIntlayer('subscriptionsPage');
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const { subscriptions, loading, merging, merge } = useMergeIntoSubscription(open);

  const choices = useMemo(() => {
    const query = search.trim().toLowerCase();
    return subscriptions
      .filter(sub => sub.status !== 'cancelled')
      .filter(sub => !query || sub.vendorName.toLowerCase().includes(query))
      .sort(
        (a, b) =>
          Number(sameName(vendorName, b.vendorName)) - Number(sameName(vendorName, a.vendorName)) ||
          a.vendorName.localeCompare(b.vendorName),
      );
  }, [subscriptions, search, vendorName]);

  if (payments.length === 0) return null;

  const pick = async (target: SubscriptionItem): Promise<void> => {
    if (await merge(target, payments)) {
      setOpen(false);
      onMerged();
    }
  };

  return (
    <>
      <Button
        variant="text"
        size="small"
        onClick={() => setOpen(true)}
        sx={{ alignSelf: 'flex-start', px: 0 }}
      >
        {t.mergeWith}
      </Button>
      <DrawerShell
        isOpen={open}
        onClose={() => setOpen(false)}
        position="right"
        width="sm"
        showCloseButton={false}
        title={
          <div className="seneca-payable-drawer__title-wrap">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="seneca-payable-drawer__back-btn"
              aria-label={page.cancel.value}
            >
              <ChevronLeft size={20} />
            </button>
            <span style={{ fontSize: 15, fontWeight: 500, color: 'var(--foreground)' }}>
              {t.title}
            </span>
          </div>
        }
      >
        <div className="seneca-merge-subscription">
          <p className="seneca-merge-subscription__hint">{t.hint}</p>
          <TextField
            size="small"
            fullWidth
            placeholder={t.search.value}
            value={search}
            onChange={event => setSearch(event.target.value)}
          />
          {!loading && choices.length === 0 && (
            <p className="seneca-merge-subscription__hint">{t.empty}</p>
          )}
          <ul className="seneca-merge-subscription__list">
            {choices.map(sub => (
              <li key={sub.id}>
                <button
                  type="button"
                  className="seneca-merge-subscription__row"
                  disabled={merging}
                  onClick={() => void pick(sub)}
                >
                  <VendorIcon
                    vendorName={sub.vendorName}
                    vendorDomain={sub.vendorDomain}
                    size={28}
                  />
                  <span className="seneca-merge-subscription__name">{sub.vendorName}</span>
                  <span className="seneca-merge-subscription__meta">
                    {formatWholeNumber(sub.amount)} {sub.currency} · {page[sub.frequency]}
                    {sub.nextChargeDate
                      ? ` · ${formatStoredDateWithOptions(sub.nextChargeDate, { day: 'numeric', month: 'short' })}`
                      : ''}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </DrawerShell>
    </>
  );
}
