'use client';

import { useQuery } from '@tanstack/react-query';
import { useWorkspaceId } from '@/app/hooks/useWorkspaceId';
import { apiQueryDecoded } from '@/app/lib/query-fn-schema';
import { queryKeys } from '@/app/lib/query-keys';

/**
 * Which days an account's statements cover, and whether their balances chain
 * up. Under the account's key, so every write that refreshes the account
 * (an import, an attached or removed statement) refreshes this too.
 */
export function useStatementCoverage(id: string) {
  const workspaceId = useWorkspaceId();
  const coverage = useQuery({
    queryKey: [...queryKeys.wallet(workspaceId, id), 'coverage'],
    queryFn: ({ signal }) =>
      apiQueryDecoded({
        url: `/wallets/${id}/statement-coverage`,
        signal,
        contract: 'StatementCoverage',
      }),
    enabled: Boolean(workspaceId && id),
  });
  return coverage.data ?? null;
}
