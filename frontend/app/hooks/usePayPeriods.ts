'use client';

import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import type { PayPeriodContext, PayPeriodsResponse } from '@/app/lib/contracts';
import { isCalendarMonth } from '@/app/lib/contracts/workspaces/pay-period';
import { apiQueryDecoded } from '@/app/lib/query-fn-schema';
import { queryKeys } from '@/app/lib/query-keys';
import { useWorkspaceId } from './useWorkspaceId';

export type UsePayPeriodsReturn = {
  data: PayPeriodsResponse | undefined;
  /**
   * What `periodBounds` / `periodOf` need, once loaded; undefined before.
   * Undefined also when the month is the calendar month, so a caller can
   * keep its calendar behaviour with a plain `context ?` check.
   */
  context: PayPeriodContext | undefined;
};

/**
 * The workspace's own month (Settings → Data → Start of the month): the rule
 * and what it needs, so any page can bound, name and label a month the way
 * the backend sums it. One cached request per workspace.
 */
export function usePayPeriods(): UsePayPeriodsReturn {
  const workspaceId = useWorkspaceId();
  const query = useQuery({
    queryKey: queryKeys.payPeriods(workspaceId),
    queryFn: ({ signal }) =>
      apiQueryDecoded({ url: '/pay-periods', signal, contract: 'PayPeriodsResponse' }),
    enabled: Boolean(workspaceId),
    staleTime: 5 * 60_000,
  });
  const data = query.data;
  const context = useMemo<PayPeriodContext | undefined>(() => {
    if (!data) return undefined;
    const value: PayPeriodContext = {
      monthStart: data.monthStart,
      salary: data.salary,
      holidays: data.holidays,
    };
    return isCalendarMonth(value) ? undefined : value;
  }, [data]);
  return { data, context };
}
