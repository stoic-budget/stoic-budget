'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { useWorkspaceId } from '@/app/hooks/useWorkspaceId';
import { useIntlayer } from '@/app/i18n';
import { getApiErrorMessage } from '@/app/lib/api-error';
import { payablesApi } from '@/app/lib/payables-api';
import { queryKeys } from '@/app/lib/query-keys';

/** "Not this payment": the row leaves this bill's candidates and is never proposed again. */
export function usePayableMatchRejection(payableId: string) {
  const workspaceId = useWorkspaceId();
  const queryClient = useQueryClient();
  const t = useIntlayer('payableRecurrence');
  const mutation = useMutation({
    mutationFn: (transactionId: string) => payablesApi.rejectMatch(payableId, transactionId),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: queryKeys.payablePaymentCandidates({ workspaceId, payableId }),
      }),
    onError: error => toast.error(getApiErrorMessage(error, t.failedToast.value)),
  });
  return { reject: mutation.mutate, rejecting: mutation.isPending };
}
