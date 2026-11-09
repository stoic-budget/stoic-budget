import { useMemo } from 'react';
import { resolveLocale } from '@/app/(main)/dashboard/helpers/dashboard-helpers';
import { usePayPeriods } from '@/app/hooks/usePayPeriods';
import { useLocale } from '@/app/i18n';
import {
  formatPeriodRange,
  periodBounds,
  periodOf,
} from '@/app/lib/contracts/workspaces/pay-period';
import { currentMonthKey, monthEndOrToday } from './month-end';
import { useMonthLabel } from './use-month-label';

const pad = (value: number): string => String(value).padStart(2, '0');
const keyOf = (date: Date): string => `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
const dayOf = (date: Date): string => `${keyOf(date)}-${pad(date.getDate())}`;

/**
 * The month a dashboard shows, named: "August 2026", or its days
 * ("15 Oct – 14 Nov") when the workspace starts its month on another day than
 * the 1st, so the label says which days the figures cover. `inProgress` when
 * today falls in it.
 */
export function useShownMonth(displayMonth: Date): { label: string; inProgress: boolean } {
  const monthLabel = useMonthLabel(displayMonth);
  const { locale } = useLocale();
  const { context } = usePayPeriods();
  return useMemo(() => {
    const key = keyOf(displayMonth);
    const today = new Date();
    if (!context) return { label: monthLabel, inProgress: key === keyOf(today) };
    return {
      label: formatPeriodRange(periodBounds(context, key), resolveLocale(locale)),
      inProgress: key === periodOf(context, dayOf(today)),
    };
  }, [context, displayMonth, locale, monthLabel]);
}

/**
 * The workspace's present month and the day another month is measured on, by
 * its month rule: `current` is the name of the period today falls in (under
 * day 15 that is still October on 9 November), and `measuredOn(month)` the
 * last day of the period of that name, or null for the present one. Without a
 * rule (or before it loads) both are the calendar month's.
 */
export function usePresentPeriod(): {
  current: string;
  measuredOn: (month: string) => string | null;
} {
  const { context } = usePayPeriods();
  const now = new Date();
  return {
    current: currentMonthKey(now, context),
    measuredOn: (month: string) => monthEndOrToday(month, now, context),
  };
}
