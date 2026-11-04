'use client';

import { Box } from '@mui/material';
import { useSearchParams } from 'next/navigation';
import type React from 'react';
import { SubscriptionsMonthWidget } from '@/app/(main)/dashboard/components/SubscriptionsMonthWidget';
import { parseMonthParam } from '@/app/(main)/dashboard/helpers/dashboard-url-state';
import { currentMonthKey } from '@/app/components/dashboard/month-end';
import { OverviewMonthProvider } from '@/app/components/dashboard/overview-month';
import { useLocale } from '@/app/i18n';
import { formatMoney } from '@/app/lib/format-money';

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
  if (!(month && parseMonthParam(month)) || month === currentMonthKey()) {
    return null;
  }
  return (
    <Box sx={{ mb: 3 }}>
      <OverviewMonthProvider value={month}>
        <SubscriptionsMonthWidget formatAmount={value => formatMoney(value, currency, locale)} />
      </OverviewMonthProvider>
    </Box>
  );
}
