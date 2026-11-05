'use client';

import { useCallback, useEffect, useState } from 'react';
import apiClient from '@/app/lib/api';
import type { ContractInput } from '@/app/lib/query-fn-schema';
import type { AggregateFn } from '../utils/types';

/** Which total each column shows: read from the table's saved view, saved again on change. */
export function useAggregateSelection(
  tableId: string,
  savedColumns: Record<string, { aggregate?: AggregateFn | null } | undefined> | undefined,
) {
  const [aggregates, setAggregates] = useState<Record<string, AggregateFn>>({});
  useEffect(() => {
    const saved = savedColumns ?? {};
    const next: Record<string, AggregateFn> = {};
    for (const [key, settings] of Object.entries(saved)) {
      if (settings?.aggregate) {
        next[key] = settings.aggregate;
      }
    }
    setAggregates(next);
  }, [savedColumns]);

  const setAggregate = useCallback(
    (columnKey: string, fn: AggregateFn | null) => {
      setAggregates(prev => {
        const { [columnKey]: _removed, ...rest } = prev;
        return fn ? { ...rest, [columnKey]: fn } : rest;
      });
      apiClient
        .patch(`/custom-tables/${tableId}/view-settings/columns`, {
          columnKey,
          aggregate: fn,
        } satisfies ContractInput<'UpdateCustomTableViewSettingsColumnBody'>)
        .catch(error => console.error('Failed to persist column aggregate:', error));
    },
    [tableId],
  );
  return { aggregates, setAggregates, setAggregate };
}
