'use client';

import { useState } from 'react';
import type { StatementFilterDate } from '@/app/(main)/statements/components/filters/statement-filters';
import { usePayPeriods } from '@/app/hooks/usePayPeriods';
import type { PayPeriodContext } from '@/app/lib/contracts';
import { dateFilterToRange, monthDateFilter } from '../lib/review-inbox-model';

type Linked = { context: PayPeriodContext | undefined; filter: StatementFilterDate | null };

/**
 * The days Review filters on. A link naming a month (the dashboard's month
 * close) opens on that month — the workspace's own when it starts on another
 * day than the 1st — so the list holds exactly what the link counted. When
 * that rule loads after the page opened, the link's month is read again.
 */
export function useLinkedMonthRange(month: string | null) {
  const { context } = usePayPeriods();
  const [linked, setLinked] = useState<Linked>(() => ({
    context,
    filter: monthDateFilter(month, context),
  }));
  const [range, setRange] = useState(() => dateFilterToRange(linked.filter, new Date()));
  if (month && context !== linked.context) {
    const filter = monthDateFilter(month, context);
    setLinked({ context, filter });
    setRange(dateFilterToRange(filter, new Date()));
  }
  return {
    initialDateFilter: linked.filter,
    from: range.from,
    to: range.to,
    setFrom: (from: string) => setRange(current => ({ ...current, from })),
    setTo: (to: string) => setRange(current => ({ ...current, to })),
  };
}
