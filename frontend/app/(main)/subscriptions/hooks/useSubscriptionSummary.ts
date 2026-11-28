import { useQuery } from '@tanstack/react-query';
import { apiQueryDecoded } from '@/app/lib/query-fn-schema';
import { queryKeys } from '@/app/lib/query-keys';

/** The workspace's subscription figures; one request however many parts of the page read them. */
export function useSubscriptionSummary(workspaceId: string | null) {
  return useQuery({
    queryKey: queryKeys.subscriptionsSummary(workspaceId),
    queryFn: ({ signal }) =>
      apiQueryDecoded({ url: '/subscriptions/summary', signal, contract: 'SubscriptionSummary' }),
    enabled: Boolean(workspaceId),
  });
}
