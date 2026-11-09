'use client';

import { useQuery } from '@tanstack/react-query';
import { useWorkspaceId } from '@/app/hooks/useWorkspaceId';
import { apiQueryDecoded, type ContractInput } from '@/app/lib/query-fn-schema';
import { queryKeys } from '@/app/lib/query-keys';

export type { InvestmentAllocation } from '@/app/lib/contracts';

/**
 * Every holding by class, sector, region and country, funds spread by their
 * breakdown. Kept under net worth's key, so a holding, a trade or a metal lot
 * that re-reads net worth re-reads this too. `excluded` are the accounts the
 * page leaves out, so the mix adds up to the same holdings as the rest of it.
 */
export function useInvestmentAllocation(excluded: string[]) {
  const workspaceId = useWorkspaceId();
  const params = (
    excluded.length > 0 ? { exclude: excluded.join(',') } : {}
  ) satisfies ContractInput<'InvestmentAllocationQuery'>;
  return useQuery({
    queryKey: [...queryKeys.investmentAllocation(workspaceId), ...excluded],
    queryFn: ({ signal }) =>
      apiQueryDecoded({
        url: '/investments/allocation',
        params,
        signal,
        contract: 'InvestmentAllocation',
      }),
    enabled: Boolean(workspaceId),
  });
}
