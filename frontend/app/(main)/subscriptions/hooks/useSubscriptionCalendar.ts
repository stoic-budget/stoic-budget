import { useQuery } from '@tanstack/react-query';
import { apiQueryDecoded, type ContractInput } from '@/app/lib/query-fn-schema';
import { queryKeys } from '@/app/lib/query-keys';

/** How many months the charge calendar shows. */
export const CALENDAR_MONTHS = 6;

/** The workspace's charge calendar; one request however many parts of the page read it. */
export function useSubscriptionCalendar(workspaceId: string | null) {
  return useQuery({
    queryKey: queryKeys.subscriptionsChargeCalendar({ workspaceId, months: CALENDAR_MONTHS }),
    queryFn: ({ signal }) =>
      apiQueryDecoded({
        url: '/subscriptions/charge-calendar',
        params: { months: CALENDAR_MONTHS } satisfies ContractInput<'ChargeCalendarQuery'>,
        signal,
        contract: 'SubscriptionChargeCalendar',
      }),
    enabled: Boolean(workspaceId),
  });
}
