'use client';

import EventRepeatOutlined from '@mui/icons-material/EventRepeatOutlined';
import Skeleton from '@mui/material/Skeleton';
import { useQuery } from '@tanstack/react-query';
import type React from 'react';
import type { DonutSlice } from '@/app/components/charts/CategoryDonut';
import { LazyCategoryDonut } from '@/app/components/charts/lazy-charts';
import { useOverviewMonth } from '@/app/components/dashboard/overview-month';
import {
  CardEmpty,
  CardLink,
  Chip,
  ChipGroup,
  DashboardCard,
  ListRow,
} from '@/app/components/dashboard/ui';
import { ListRowsSkeleton } from '@/app/components/dashboard/ui/card-skeletons';
import { usePresentPeriod } from '@/app/components/dashboard/use-period-label';
import { fillTemplateNodes, PrivateAmount } from '@/app/components/ui/private-amount';
import { VendorIcon } from '@/app/components/VendorIcon';
import { useWorkspaceId } from '@/app/hooks/useWorkspaceId';
import { useIntlayer, useLocale } from '@/app/i18n';
import { formatMoney } from '@/app/lib/format-money';
import { apiQueryDecoded, type ContractInput } from '@/app/lib/query-fn-schema';
import { queryKeys } from '@/app/lib/query-keys';
import { formatStoredDateWithOptions } from '@/app/lib/user-format-store';
import { resolveLocale, text } from '../helpers/dashboard-helpers';

const PAID_TONE = 'var(--cat-tone-1)';
const UNPAID_TONE = 'var(--cat-tone-4)';
// The card sits beside others on Overview; the full list is one click away.
const MAX_ROWS = 5;
// The donut's ring (outer 90%, inner 56% of its 220px box), cut out of a disc.
const DONUT_RING_SX = { mask: 'radial-gradient(circle, transparent 61px, black 62px)' };

// A charge this close is worth a nudge: "in 3 days" beside its date.
const SOON_DAYS = 7;

const fill = (template: string, values: Record<string, string>): string =>
  Object.entries(values).reduce(
    (text, [key, value]) => text.replaceAll(`{{${key}}}`, value),
    template,
  );

/** Whole days from today to a `YYYY-MM-DD` day, by the calendar rather than the clock. */
function daysFromToday(day: string): number {
  const [year, month, date] = day.split('-').map(Number);
  const today = new Date();
  const start = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((Date.UTC(year, month - 1, date) - start) / 86_400_000);
}

type SubscriptionsMonthWidgetProps = {
  /** Formats an amount in the workspace currency, which the answer is in. */
  formatAmount: (value: number) => string;
};

/**
 * The subscriptions page; a past month shows what was charged in it above the
 * list. `present` is the month we are in, by the workspace's month rule.
 */
function subscriptionsHref(month: string, present: string, focus?: string): string {
  const params = new URLSearchParams();
  if (month !== present) params.set('month', month);
  if (focus) params.set('focus', focus);
  const query = params.toString();
  return query ? `/subscriptions?${query}` : '/subscriptions';
}

/**
 * The subscription charges of the Overview's month (this month's elsewhere) as
 * a ring, paid so far against still to come, beside the subscriptions
 * themselves: icon, name, a dot in the ring's colour with "Paid" or the charge
 * date (and how soon, for this week's), and the amount. Below, what all the
 * subscriptions cost a month and what the subscriptions page flags.
 */
export function SubscriptionsMonthWidget({
  formatAmount,
}: SubscriptionsMonthWidgetProps): React.JSX.Element | null {
  const t = useIntlayer('subscriptionsMonthWidget');
  const links = useIntlayer('overviewWidgets');
  const shown = useOverviewMonth();
  const present = usePresentPeriod().current;
  const month = shown?.month ?? present;
  const { locale } = useLocale();
  const workspaceId = useWorkspaceId();
  // Cached, so the widget is drawn at once when Overview is opened again.
  const { data, isPending } = useQuery({
    queryKey: queryKeys.subscriptionsMonthStatus(workspaceId, month),
    queryFn: ({ signal }) =>
      apiQueryDecoded({
        contract: 'SubscriptionMonthStatus',
        url: '/subscriptions/month-status',
        params: { month } satisfies ContractInput<'SubscriptionMonthStatusQuery'>,
        signal,
      }),
    enabled: Boolean(workspaceId),
    // Another month keeps the ring in place until its figures arrive.
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey[1] === workspaceId ? previous : undefined,
  });
  // Same request and key as the subscriptions page, so either fills the other's cache.
  const summary = useQuery({
    queryKey: queryKeys.subscriptionsSummary(workspaceId),
    queryFn: ({ signal }) =>
      apiQueryDecoded({ url: '/subscriptions/summary', signal, contract: 'SubscriptionSummary' }),
    enabled: Boolean(workspaceId),
  });

  if (isPending) {
    return (
      <DashboardCard
        title={t.title}
        subtitle={shown?.label}
        action={
          <CardLink href={subscriptionsHref(month, present)}>{links.allSubscriptions}</CardLink>
        }
      >
        <div className="seneca-dashboard__categories" aria-hidden="true">
          <div
            className="seneca-dashboard__donut"
            style={{ display: 'grid', placeItems: 'center' }}
          >
            <Skeleton variant="circular" width={198} height={198} sx={DONUT_RING_SX} />
          </div>
          <ListRowsSkeleton rows={4} leading={24} />
        </div>
      </DashboardCard>
    );
  }

  // A failed request shows the empty state rather than breaking the dashboard.
  const total = data ? data.paidCount + data.unpaidCount : 0;
  // An empty part would still get the donut's minimum angle.
  // The hover says what each part is in the subscriptions' own currencies;
  // nothing to add when they are all in the workspace's, the amount says it.
  const inOwnCurrencies = (amounts: Array<{ currency: string; amount: number }>) =>
    amounts.length === 1 && amounts[0].currency === data?.currency
      ? undefined
      : amounts.map(entry => formatMoney(entry.amount, entry.currency, locale));
  const slices: DonutSlice[] = data
    ? [
        {
          key: 'paid',
          name: text(t.paid),
          value: data.paidAmount,
          color: PAID_TONE,
          details: inOwnCurrencies(data.paidByCurrency),
        },
        {
          key: 'unpaid',
          name: text(t.unpaid),
          value: data.unpaidAmount,
          color: UNPAID_TONE,
          details: inOwnCurrencies(data.unpaidByCurrency),
        },
      ].filter(slice => slice.value > 0)
    : [];
  // "Nov 18": the month is the one in the card's subtitle, so the year adds nothing.
  const chargeDay = (value: string | null): string =>
    value
      ? formatStoredDateWithOptions(
          value,
          { month: 'short', day: 'numeric' },
          resolveLocale(locale),
        )
      : '';
  const relative = new Intl.RelativeTimeFormat(resolveLocale(locale), { numeric: 'auto' });
  // Only the month under way has charges "in 3 days".
  const soon = (value: string | null): string | null => {
    if (!value || month !== present) {
      return null;
    }
    const days = daysFromToday(value.slice(0, 10));
    return days >= 0 && days <= SOON_DAYS ? relative.format(days, 'day') : null;
  };
  // "Nov 21 · in 3 days"
  const chargeLine = (value: string | null): string =>
    [chargeDay(value) || text(t.unpaid), soon(value)].filter(Boolean).join(' · ');
  const flags = summary.data
    ? [
        summary.data.priceChangeCount > 0 && {
          label: fill(links.priceChanges.value, {
            count: String(summary.data.priceChangeCount),
          }),
          // Rings every subscription whose price changed (data-attention-group).
          href: subscriptionsHref(month, present, 'price-changed'),
        },
        summary.data.duplicateCount > 0 && {
          label: fill(links.duplicates.value, { count: String(summary.data.duplicateCount) }),
          href: undefined,
        },
      ].filter((flag): flag is { label: string; href: string | undefined } => Boolean(flag))
    : [];

  return (
    <DashboardCard
      title={t.title}
      subtitle={shown?.label}
      action={
        <CardLink href={subscriptionsHref(month, present)}>{links.allSubscriptions}</CardLink>
      }
    >
      {total === 0 ? (
        <CardEmpty icon={EventRepeatOutlined}>{t.emptyDescription}</CardEmpty>
      ) : (
        <div className="seneca-dashboard__categories">
          <div className="seneca-dashboard__donut">
            <LazyCategoryDonut slices={slices} formatAmount={formatAmount} />
          </div>
          <div className="seneca-dashboard__list">
            {(data?.items ?? []).slice(0, MAX_ROWS).map(item => (
              <ListRow
                key={item.subscriptionId}
                // Rings this subscription's row there (see useAttentionFocus).
                href={subscriptionsHref(month, present, `subscription:${item.subscriptionId}`)}
                leading={
                  <VendorIcon
                    vendorName={item.vendorName}
                    vendorDomain={item.vendorDomain}
                    size={24}
                  />
                }
                primary={item.vendorName}
                secondary={
                  <>
                    <span
                      className="seneca-dashboard__legend-dot"
                      style={{ background: item.paid ? PAID_TONE : UNPAID_TONE }}
                      aria-hidden="true"
                    />
                    {item.paid ? text(t.paid) : chargeLine(item.nextChargeDate)}
                  </>
                }
                trailing={<PrivateAmount>{formatAmount(item.amount)}</PrivateAmount>}
              />
            ))}
          </div>
        </div>
      )}
      {summary.data && summary.data.totalMonthlyCost > 0 && (
        <p className="seneca-dashboard__card-note seneca-dashboard__card-note--footer">
          {fillTemplateNodes(links.subscriptionsMonthly.value, {
            amount: formatAmount(summary.data.totalMonthlyCost),
          })}
        </p>
      )}
      {flags.length > 0 && (
        <ChipGroup>
          {flags.map(flag => (
            <Chip key={flag.label} tone="warning" href={flag.href}>
              {flag.label}
            </Chip>
          ))}
        </ChipGroup>
      )}
    </DashboardCard>
  );
}
