'use client';

import { useQuery } from '@tanstack/react-query';
import { readReportsView } from '@/app/(main)/reports/components/cash-flow/useCashFlowMap';
import { useViewPreference } from '@/app/components/transactions/hooks/useViewPreference';
import { useWorkspaceId } from '@/app/hooks/useWorkspaceId';
import { apiQueryDecoded, type ContractInput } from '@/app/lib/query-fn-schema';
import { queryKeys } from '@/app/lib/query-keys';

/** One category with its parent and children: the header of the category page. */
export function useCategory(id: string) {
  const workspaceId = useWorkspaceId();
  return useQuery({
    queryKey: queryKeys.category(workspaceId, id),
    queryFn: ({ signal }) =>
      apiQueryDecoded({ url: `/categories/${id}`, signal, contract: 'CategoryItem' }),
    enabled: Boolean(workspaceId && id),
    retry: false,
  });
}

/**
 * The category's twelve months, counted as the reports count them: with
 * refunds netted when this person turned that on in Reports, so the page and
 * the report never show two totals. Waits for that switch before asking.
 */
export function useCategorySummary(id: string) {
  const workspaceId = useWorkspaceId();
  const view = useViewPreference('reports', readReportsView);
  const params = (
    view.state?.netRefunds ? { netRefunds: true } : {}
  ) satisfies ContractInput<'CategorySummaryQuery'>;
  return useQuery({
    queryKey: [...queryKeys.categorySummary(workspaceId, id), params],
    queryFn: ({ signal }) =>
      apiQueryDecoded({
        url: `/categories/${id}/summary`,
        params,
        signal,
        contract: 'CategorySummary',
      }),
    enabled: Boolean(workspaceId && id) && view.state !== undefined,
    retry: false,
  });
}
