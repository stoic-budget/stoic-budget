'use client';

import { resolveBankLogo } from '@bank-logos';
import clsx from 'clsx';
import type React from 'react';
import { parseDateOnly } from '@/app/(main)/dashboard/helpers/dashboard-helpers';
import { BankLogoAvatar } from '@/app/components/BankLogoAvatar';
import { PrivateAmount } from '@/app/components/ui/private-amount';
import { useWalletCoverage } from '@/app/hooks/useDashboard';
import { useIntlayer, useLocale } from '@/app/i18n';
import { formatMoney } from '@/app/lib/format-money';
import { plural } from '@/app/lib/plural';
import {
  byAttention,
  type CoverageRow,
  type CoverageStatus,
  needsAttention,
} from './data-coverage';
import { useTodayNote } from './overview-month';
import { CardLink, DashboardCard, ListRow } from './ui';
import { ListRowsSkeleton } from './ui/card-skeletons';

/** An account by its name; a bank by its name and the end of its number. */
function nameOf(row: CoverageRow): string {
  if (row.name) {
    return row.name;
  }
  const resolved = resolveBankLogo(row.bankName);
  // A bank with no logo of its own keeps the name it came with.
  const bank =
    resolved.key === 'other' && row.bankName && row.bankName !== 'other'
      ? row.bankName
      : resolved.displayName;
  return row.accountTail ? `${bank} ••${row.accountTail}` : bank;
}

/**
 * How far each bank account's statements reach, today: one line per account
 * with its bank's logo, the day its data runs to, and the one thing to do about
 * it, if anything. A row opens the account, or Accounts for a bank no account
 * holds yet, where its statements are offered.
 */
export function DataCoverageCard(): React.JSX.Element | null {
  const t = useIntlayer('dataCoverageCard');
  const overview = useIntlayer('overviewTab');
  const { locale } = useLocale();
  const today = useTodayNote();
  const { data, isPending } = useWalletCoverage();

  if (!isPending && !data?.rows.length) {
    return null;
  }

  const now = new Date();
  const dayFormat = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' });
  const dayWithYear = new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  const monthFormat = new Intl.DateTimeFormat(locale, { month: 'long' });
  const monthWithYear = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' });
  const dayOf = (key: string) => {
    const date = parseDateOnly(key);
    return (date.getFullYear() === now.getFullYear() ? dayFormat : dayWithYear).format(date);
  };
  const monthOf = (key: string) => {
    const date = parseDateOnly(`${key}-01`);
    return (date.getFullYear() === now.getFullYear() ? monthFormat : monthWithYear).format(date);
  };

  const statusText = (row: CoverageRow, status: CoverageStatus): React.ReactNode => {
    switch (status.kind) {
      case 'behind':
        return t.behind.value.replace('{{month}}', monthOf(status.month));
      case 'differs': {
        const [before, after] = t.differs.value.split('{{amount}}');
        return (
          <>
            {before}
            <PrivateAmount>{formatMoney(status.amount, row.currency ?? '', locale)}</PrivateAmount>
            {after}
          </>
        );
      }
      case 'waiting':
        return plural(locale, status.count, {
          one: t.waitingOne.value,
          few: t.waitingFew.value,
          many: t.waitingMany.value,
        });
      default:
        return t.upToDate.value;
    }
  };

  return (
    <DashboardCard
      title={t.title}
      subtitle={today ?? undefined}
      action={<CardLink href="/accounts">{overview.viewAll}</CardLink>}
    >
      {isPending ? (
        <ListRowsSkeleton rows={3} leading={36} />
      ) : (
        <div className="seneca-dashboard__list">
          {byAttention(data?.rows ?? [], now, nameOf).map(({ row, status }) => (
            <ListRow
              key={row.walletId ?? `${row.bankName}-${row.accountTail}`}
              href={row.walletId ? `/accounts/${row.walletId}` : '/accounts'}
              className="seneca-dashboard__row--status"
              leading={<BankLogoAvatar bankName={row.bankName} size={36} />}
              primary={nameOf(row)}
              secondary={
                row.dataTo ? t.dataTo.value.replace('{{date}}', dayOf(row.dataTo)) : undefined
              }
              trailing={
                <span className={clsx(!needsAttention(status) && 'seneca-dashboard__muted')}>
                  <span
                    className={clsx(
                      'seneca-dashboard__stat-dot',
                      needsAttention(status)
                        ? 'seneca-dashboard__stat-dot--warning'
                        : 'seneca-dashboard__stat-dot--quiet',
                    )}
                    aria-hidden="true"
                  />
                  {statusText(row, status)}
                </span>
              }
            />
          ))}
        </div>
      )}
    </DashboardCard>
  );
}
