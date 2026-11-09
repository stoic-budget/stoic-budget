'use client';

import { useQuery } from '@tanstack/react-query';
import { useWorkspaceId } from '@/app/hooks/useWorkspaceId';
import { apiQueryDecoded } from '@/app/lib/query-fn-schema';
import { queryKeys } from '@/app/lib/query-keys';

/** The investment and retirement accounts a trades sheet can go to. */
export function useInvestmentAccountOptions(enabled: boolean) {
  const workspaceId = useWorkspaceId();
  const query = useQuery({
    queryKey: queryKeys.investments(workspaceId),
    queryFn: ({ signal }) =>
      apiQueryDecoded({ url: '/investments', signal, contract: 'InvestmentAccountList' }),
    enabled: enabled && Boolean(workspaceId),
  });
  return (query.data ?? []).map(account => ({ id: account.id, name: account.name }));
}
