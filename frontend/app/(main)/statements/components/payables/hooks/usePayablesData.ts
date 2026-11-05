'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect } from 'react';
import toast from 'react-hot-toast';
import { useWorkspace } from '@/app/contexts/WorkspaceContext';
import { useAuth } from '@/app/hooks/useAuth';
import { useWorkspaceId } from '@/app/hooks/useWorkspaceId';
import { getApiErrorMessage } from '@/app/lib/api-error';
import {
  type ListPayablesParams,
  type PayableDirection,
  type PayablesSummary,
  payablesApi,
} from '@/app/lib/payables-api';
import { queryKeys } from '@/app/lib/query-keys';
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
  page,
  setPage,
  loadFailedMessage,
}: {
  direction: PayableDirection;
  filters: PayablesFiltersState;
  page: number;
  setPage: (page: number) => void;
  loadFailedMessage: string;
}) {
  const { user, loading: authLoading } = useAuth();
  const { currentWorkspace, loading: workspaceLoading } = useWorkspace();
  const workspaceId = useWorkspaceId();
  const queryClient = useQueryClient();
  const params = buildPayablesListParams(filters, {
    page,
    limit: PAGE_SIZE,
    direction,
  }) as ListPayablesParams;

  const { data, error, isPending } = useQuery({
    queryKey: [...queryKeys.payablesList(workspaceId), params],
    queryFn: async () => {
      const [summary, list] = await Promise.all([
        payablesApi.getSummary(direction),
        payablesApi.list(params),
      ]);
      return { summary, list };
    },
    enabled: Boolean(user && currentWorkspace) && !authLoading && !workspaceLoading,
    // Invoices, statements and bank checks change these rows from other pages,
    // so coming back always reads them again.
    staleTime: 0,
  });

  const totalPages = Math.max(1, data?.list.totalPages || 1);
  const total = data?.list.total ?? 0;
  // The filtered results shrank under the page we were on.
  const pastTheEnd = total > 0 && page > totalPages;
  useEffect(() => {
    if (pastTheEnd) {
      setPage(totalPages);
    }
  }, [pastTheEnd, totalPages, setPage]);

  useEffect(() => {
    if (error) {
      toast.error(getApiErrorMessage(error, loadFailedMessage));
    }
  }, [error, loadFailedMessage]);

  const reload = useCallback(
    () => queryClient.invalidateQueries({ queryKey: queryKeys.payablesList(workspaceId) }),
    [queryClient, workspaceId],
  );

  return {
    summary: data?.summary ?? DEFAULT_SUMMARY,
    items: data?.list.data ?? [],
    total,
    totalPages,
    loading: isPending || pastTheEnd,
    reload,
  };
}
