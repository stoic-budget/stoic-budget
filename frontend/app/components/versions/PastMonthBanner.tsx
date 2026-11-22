'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type React from 'react';
import { resolveLocale } from '@/app/(main)/dashboard/helpers/dashboard-helpers';
import { parseMonthParam } from '@/app/(main)/dashboard/helpers/dashboard-url-state';
import { usePresentPeriod } from '@/app/components/dashboard/use-period-label';
import { Button } from '@/app/components/ui/button';
import { useIntlayer, useLocale } from '@/app/i18n';
import { AS_OF_PARAM, readAsOf } from '@/app/lib/as-of-month';
import { BAR_STYLE } from './VersionBanner';

/**
 * The version banner's strip over a page opened from a past month of the
 * dashboard: which month it shows, that these are not today's figures, and the
 * way back to the dashboard on that month. Nothing to save: it is no backup.
 */
export function PastMonthBanner(): React.JSX.Element | null {
  const pathname = usePathname();
  const asOf = readAsOf(useSearchParams()?.get(AS_OF_PARAM), usePresentPeriod().current);
  if (!asOf || pathname === '/dashboard') {
    return null;
  }
  return <PastMonthBar month={asOf} />;
}

function PastMonthBar({ month }: { month: string }): React.JSX.Element {
  const t = useIntlayer('pastMonthBanner');
  const { locale } = useLocale();
  const router = useRouter();
  const [before = '', after = ''] = t.viewing.value.split('{{month}}');
  const label = new Intl.DateTimeFormat(resolveLocale(locale), {
    month: 'long',
    year: 'numeric',
  }).format(parseMonthParam(month) ?? new Date());

  return (
    <div role="status" style={BAR_STYLE}>
      <span>
        {before}
        <span style={{ color: 'var(--foreground)', fontWeight: 500 }}>{label}</span>
        {after} · {t.notCurrent}
      </span>
      <Button variant="ghost" size="sm" onClick={() => router.push(`/dashboard?month=${month}`)}>
        {t.back}
      </Button>
    </div>
  );
}
