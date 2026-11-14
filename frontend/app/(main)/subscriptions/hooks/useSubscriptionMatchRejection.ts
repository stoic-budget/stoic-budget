'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { useWorkspaceId } from '@/app/hooks/useWorkspaceId';
import { useIntlayer } from '@/app/i18n';
import apiClient from '@/app/lib/api';
import { getApiErrorMessage } from '@/app/lib/api-error';
import type { ContractInput } from '@/app/lib/query-fn-schema';

/** "Not this payment": the row leaves this subscription's candidates for good. */
export function useSubscriptionMatchRejection(subscriptionId: string | undefined) {
  const workspaceId = useWorkspaceId();
  const queryClient = useQueryClient();
  const t = useIntlayer('payableRecurrence');
  const mutation = useMutation({
    mutationFn: async (transactionId: string) => {
      await apiClient.post(`/subscriptions/${subscriptionId}/match-rejections`, {
        transactionId,
      } satisfies ContractInput<'RejectSubscriptionMatchBody'>);
    },
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ['subscriptions', workspaceId, 'charge-candidates'],
      }),
    onError: error => toast.error(getApiErrorMessage(error, t.failedToast.value)),
  });
  return subscriptionId ? mutation.mutate : undefined;
}
