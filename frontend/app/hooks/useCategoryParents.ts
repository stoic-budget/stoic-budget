'use client';

import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useWorkspaceId } from '@/app/hooks/useWorkspaceId';
import { apiQueryDecoded } from '@/app/lib/query-fn-schema';
import { queryKeys } from '@/app/lib/query-keys';

/** The same cached list other pages read; categories change rarely. */
const CATEGORIES_STALE_TIME = 5 * 60 * 1000;

/**
 * Each category's parent, by id: enough to walk a category up to its top
 * (#658), and whether the list is settled (loaded, or failed: then only the
 * parents the budgets carry are known).
 */
export function useCategoryParents(): {
  parentOf: ReadonlyMap<string, string | null>;
  settled: boolean;
} {
  const workspaceId = useWorkspaceId();
  const { data, isPending, isError } = useQuery({
    queryKey: queryKeys.categories(workspaceId),
    queryFn: ({ signal }) =>
      apiQueryDecoded({ url: '/categories', signal, contract: 'CategoryList' }),
    staleTime: CATEGORIES_STALE_TIME,
    enabled: Boolean(workspaceId),
  });
  const parentOf = useMemo(
    () => new Map((data ?? []).map(category => [category.id, category.parentId] as const)),
    [data],
  );
  return { parentOf, settled: !isPending || isError };
}
