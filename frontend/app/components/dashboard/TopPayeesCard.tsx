'use client';

import StorefrontOutlined from '@mui/icons-material/StorefrontOutlined';
import clsx from 'clsx';
import type React from 'react';
import { usePayeesOverview } from '@/app/components/payees/usePayees';
import { PRIVATE_CLASS } from '@/app/components/ui/private-amount';
import { VendorIcon } from '@/app/components/VendorIcon';
import { useIntlayer, useLocale } from '@/app/i18n';
import { useIsWideSection } from './section-span';
import { CardEmpty, ListRow } from './ui';
import { ListRowsSkeleton } from './ui/card-skeletons';

/** Payees the card lists. */
const SHOWN = 5;

interface TopPayeesCardProps {
  /** `YYYY-MM` the card shows. */
  month: string;
  formatAmount: (value: number) => string;
}

/** A payee's share of the month's spending, in whole percent; a sliver reads "<1%". */
function shareOf(amount: number, total: number, percent: Intl.NumberFormat): string {
  const share = total > 0 ? amount / total : 0;
  return share > 0 && share < 0.005 ? `<${percent.format(0.01)}` : percent.format(share);
}

/**
 * Who the month's money went to: the biggest payees, each with its share of the
 * month's spending and how many payments made it. Counted like the Payees page,
 * which "View all" opens on the same month.
 */
export function TopPayeesCard({ month, formatAmount }: TopPayeesCardProps): React.JSX.Element {
  const t = useIntlayer('topPayeesCard');
  const wideText = useIntlayer('dashboardWideView');
  const { locale } = useLocale();
  // With the row to itself the list runs in two columns.
  const wide = useIsWideSection();
  const { data, isPending } = usePayeesOverview({
    month,
    direction: 'expense',
    search: '',
    page: 1,
    limit: SHOWN,
  });

  if (isPending) {
    return <ListRowsSkeleton rows={SHOWN} leading={36} />;
  }
  // A failed refetch keeps the list it had; only no list at all (or a first load
  // that failed) reads as a month without payments.
  if (!data?.rows.length) {
    return <CardEmpty icon={StorefrontOutlined}>{t.empty}</CardEmpty>;
  }

  const percent = new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 0 });
  return (
    <>
      <div className={clsx('seneca-dashboard__list', wide && 'seneca-dashboard__list--columns')}>
        {data.rows.map(payee => (
          <ListRow
            key={payee.id}
            href={`/statements/payees/${payee.id}`}
            leading={
              <VendorIcon vendorName={payee.name} vendorDomain={payee.vendorDomain} size={36} />
            }
            primary={payee.name}
            secondary={`${wideText.operations.value}: ${payee.count}`}
            trailing={
              <>
                <span className={clsx('seneca-dashboard__muted', PRIVATE_CLASS)}>
                  {shareOf(payee.amount, data.totalAmount, percent)}
                </span>
                <span className={PRIVATE_CLASS}>{formatAmount(payee.amount)}</span>
              </>
            }
          />
        ))}
      </div>
      {data.missingRates.length > 0 && (
        <p className="seneca-dashboard__card-note" style={{ color: 'var(--attention)' }}>
          {t.missingRates.value.replace('{{currencies}}', data.missingRates.join(', '))}
        </p>
      )}
    </>
  );
}
