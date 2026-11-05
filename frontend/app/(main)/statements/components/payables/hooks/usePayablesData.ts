'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useWorkspace } from '@/app/contexts/WorkspaceContext';
import { useAuth } from '@/app/hooks/useAuth';
import { getApiErrorMessage } from '@/app/lib/api-error';
import {
  type ListPayablesParams,
  type Payable,
  type PayableDirection,
  type PayablesSummary,
  payablesApi,
} from '@/app/lib/payables-api';
import { buildPayablesListParams, type PayablesFiltersState } from '../payables-utils';

const DEFAULT_SUMMARY: PayablesSummary = {
  toPay: 0,
  overdue: 0,
  dueThisWeek: 0,
  paidThisMonth: 0,
  paidTotal: 0,
  toPayCount: 0,
  overdueCount: 0,
  paidTotalCount: 0,
  dueThisWeekCount: 0,
  unbookedTotal: 0,
  unbookedCount: 0,
  convertedCurrencies: [],
};

export const PAGE_SIZE = 20;

/** The summary cards and the current page of the list. */
export function usePayablesData({
  direction,
  filters,
  queryPage,
  setPage,
  setQueryPage,
  loadFailedMessage,
}: {
  direction: PayableDirection;
  filters: PayablesFiltersState;
  queryPage: number;
  setPage: (page: number) => void;
  setQueryPage: (page: number) => void;
  loadFailedMessage: string;
}) {
  const { user, loading: authLoading } = useAuth();
  const { currentWorkspace, loading: workspaceLoading } = useWorkspace();
  const [summary, setSummary] = useState<PayablesSummary>(DEFAULT_SUMMARY);
  const [items, setItems] = useState<Payable[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [, setRefreshing] = useState(false);
  const requestVersionRef = useRef(0);

  const loadData = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!(user && currentWorkspace)) {
        setLoading(false);
        return;
      }

      if (options?.silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const requestVersion = ++requestVersionRef.current;

      return await (async () => {
        const [summaryResponse, listResponse] = await Promise.all([
          payablesApi.getSummary(direction),
          payablesApi.list(
            buildPayablesListParams(filters, {
              page: queryPage,
              limit: PAGE_SIZE,
              direction,
            }) as ListPayablesParams,
          ),
        ]);

        if (requestVersion !== requestVersionRef.current) {
          return;
        }

        const nextTotalPages = Math.max(1, listResponse.totalPages || 1);

        if (listResponse.total > 0 && queryPage > nextTotalPages) {
          setPage(nextTotalPages);
          setQueryPage(nextTotalPages);
          return;
        }

        setSummary(summaryResponse);
        setItems(listResponse.data);
        setTotal(listResponse.total);
        setTotalPages(nextTotalPages);
        setPage(Math.min(queryPage, nextTotalPages));
      })()
        .catch(async error => {
          if (requestVersion !== requestVersionRef.current) {
            return;
          }
          toast.error(getApiErrorMessage(error, loadFailedMessage));
        })
        .finally(async () => {
          if (requestVersion === requestVersionRef.current) {
            setLoading(false);
            setRefreshing(false);
          }
        });
    },
    [currentWorkspace, direction, filters, loadFailedMessage, queryPage, user],
  );

  useEffect(() => {
    if (authLoading || workspaceLoading) {
      return;
    }
    void loadData();
  }, [authLoading, workspaceLoading, loadData]);

  return { summary, items, total, totalPages, loading, loadData };
}
