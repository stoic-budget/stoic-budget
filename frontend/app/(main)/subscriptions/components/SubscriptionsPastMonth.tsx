'use client';

import { Box } from '@mui/material';
import { useSearchParams } from 'next/navigation';
import type React from 'react';
import { MissingRatesBanner } from '@/app/(main)/dashboard/components/MissingRatesBanner';
import { SubscriptionsMonthWidget } from '@/app/(main)/dashboard/components/SubscriptionsMonthWidget';
import { parseMonthParam } from '@/app/(main)/dashboard/helpers/dashboard-url-state';
import { OverviewMonthProvider } from '@/app/components/dashboard/overview-month';
import { usePresentPeriod } from '@/app/components/dashboard/use-period-label';
import { useWorkspaceId } from '@/app/hooks/useWorkspaceId';
import { useLocale } from '@/app/i18n';
import { formatMoney } from '@/app/lib/format-money';
import { useSubscriptionCalendar } from '../hooks/useSubscriptionCalendar';
import { useSubscriptionSummary } from '../hooks/useSubscriptionSummary';

/**
 * `?month=` of a past month (a link from the dashboard on that month): what was
 * charged in it, the same card the dashboard showed, above today's list.
 */
export function SubscriptionsPastMonth({
  currency,
}: {
  currency: string;
}): React.JSX.Element | null {
  const month = useSearchParams()?.get('month') ?? null;
  const { locale } = useLocale();
  const present = usePresentPeriod().current;
  // Under the title: totals with a currency that has no rate count it at face value (#787).
  const workspaceId = useWorkspaceId();
  // The summary's plans and the calendar's plans and bills, each currency once.
  const missingRates = [
    ...new Set([
      ...(useSubscriptionSummary(workspaceId).data?.missingRates ?? []),
      ...(useSubscriptionCalendar(workspaceId).data?.missingRates ?? []),
    ]),
  ].sort();
  const banner = (
    <Box sx={{ '& .seneca-dashboard__rates-banner': { mx: 0, mb: 2 } }}>
      <MissingRatesBanner currencies={[...missingRates]} />
    </Box>
  );
  if (!(month && parseMonthParam(month)) || month === present) {
    return missingRates.length > 0 ? banner : null;
  }
  return (
    <>
      {missingRates.length > 0 && banner}
      <Box sx={{ mb: 3 }}>
        <OverviewMonthProvider value={month}>
          <SubscriptionsMonthWidget formatAmount={value => formatMoney(value, currency, locale)} />
        </OverviewMonthProvider>
      </Box>
    </>
  );
}
