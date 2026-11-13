'use client';

import { useQuery } from '@tanstack/react-query';
import { useWorkspaceId } from '@/app/hooks/useWorkspaceId';
import { apiQueryDecoded } from '@/app/lib/query-fn-schema';
import { queryKeys } from '@/app/lib/query-keys';

/**
 * One tag with everything it counted, as Reports' By tag counts it. Under the
 * tags key, so an edited row or tag refreshes it.
 */
export function useTagSummary(id: string) {
  const workspaceId = useWorkspaceId();
  return useQuery({
    queryKey: queryKeys.tagSummary(workspaceId, id),
    queryFn: ({ signal }) =>
      apiQueryDecoded({ url: `/tags/${id}/summary`, signal, contract: 'TagSummary' }),
    enabled: Boolean(workspaceId && id),
    retry: false,
  });
}
