'use client';

import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useWorkspaceId } from '@/app/hooks/useWorkspaceId';
import { apiQueryDecoded } from '@/app/lib/query-fn-schema';
import { queryKeys } from '@/app/lib/query-keys';

/** The same cached list other pages read; categories change rarely. */
const CATEGORIES_STALE_TIME = 5 * 60 * 1000;

/** Each category's parent, by id: enough to walk a category up to its top (#658). */
export function useCategoryParents(): ReadonlyMap<string, string | null> {
  const workspaceId = useWorkspaceId();
  const { data } = useQuery({
    queryKey: queryKeys.categories(workspaceId),
    queryFn: ({ signal }) =>
      apiQueryDecoded({ url: '/categories', signal, contract: 'CategoryList' }),
    staleTime: CATEGORIES_STALE_TIME,
    enabled: Boolean(workspaceId),
  });
  return useMemo(() => {
    const parents = new Map<string, string | null>();
    for (const category of data ?? []) {
      parents.set(category.id, category.parentId);
      for (const child of category.children) parents.set(child.id, child.parentId);
    }
    return parents;
  }, [data]);
}
