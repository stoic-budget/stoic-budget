import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import toast from 'react-hot-toast';
import { useWorkspaceId } from '@/app/hooks/useWorkspaceId';
import { useIntlayer } from '@/app/i18n';
import apiClient from '@/app/lib/api';
import { apiQueryDecoded, type ContractInput } from '@/app/lib/query-fn-schema';
import { queryKeys } from '@/app/lib/query-keys';
import { clearSubscriptionDraft } from './subscription-draft';
import {
  normalizeSubscription,
  type PendingPayment,
  type SubscriptionItem,
} from './useSubscriptionsPage';

/**
 * The subscriptions a new one's payments can go to instead, and the merge
 * itself: each payment is recorded on the picked subscription at its own date
 * (a bank row by its id, a receipt by its date, amount and currency), so the
 * subscription counts it in the month it was paid.
 */
export function useMergeIntoSubscription(open: boolean): {
  subscriptions: SubscriptionItem[];
  loading: boolean;
  merging: boolean;
  merge: (target: SubscriptionItem, payments: PendingPayment[]) => Promise<boolean>;
} {
  const workspaceId = useWorkspaceId();
  const queryClient = useQueryClient();
  const text = useIntlayer('mergeIntoSubscription');
  const paymentsText = useIntlayer('subscriptionPayments');
  const [merging, setMerging] = useState(false);
  // The page's own list with no status filter: the two share one cache entry.
  const list = useQuery({
    queryKey: queryKeys.subscriptions({ workspaceId, status: 'all' }),
    queryFn: ({ signal }) =>
      apiQueryDecoded({ url: '/subscriptions', signal, contract: 'SubscriptionList' }).then(rows =>
        rows.map(normalizeSubscription),
      ),
    enabled: open && Boolean(workspaceId),
  });

  const merge = useCallback(
    async (target: SubscriptionItem, payments: PendingPayment[]): Promise<boolean> => {
      setMerging(true);
      let failed = 0;
      for (const payment of payments) {
        const body = payment.transactionId
          ? { transactionId: payment.transactionId }
          : { chargeDate: payment.date, amount: payment.amount, currency: payment.currency };
        await apiClient
          .post(
            `/subscriptions/${target.id}/charges`,
            body satisfies ContractInput<'RecordSubscriptionChargeBody'>,
          )
          .catch(() => {
            failed += 1;
          });
      }
      await queryClient.invalidateQueries({ queryKey: ['subscriptions', workspaceId] });
      setMerging(false);
      // Nothing went in: the form stays, so trying again duplicates nothing.
      if (failed === payments.length) {
        toast.error(paymentsText.paymentFailed.value);
        return false;
      }
      // Some went in: a payment that failed is added again from the subscription's card.
      if (failed > 0) toast.error(paymentsText.paymentFailed.value);
      else toast.success(text.merged.value.replace('{{vendor}}', target.vendorName));
      // The new subscription was never saved: nothing of it is left to bring back.
      clearSubscriptionDraft();
      return true;
    },
    [queryClient, workspaceId, text, paymentsText],
  );

  return { subscriptions: list.data ?? [], loading: list.isPending, merging, merge };
}
