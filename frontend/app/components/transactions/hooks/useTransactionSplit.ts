'use client';

import { useCallback, useState } from 'react';
import toast from 'react-hot-toast';
import { useIntlayer } from '@/app/i18n';
import apiClient from '@/app/lib/api';
import { getApiErrorMessage } from '@/app/lib/api-error';
import { invalidateFinancialData } from '@/app/lib/invalidate-document-lists';
import type { ContractInput } from '@/app/lib/query-fn-schema';

export interface SplitPartInput {
  amount: number;
  categoryId?: string;
  paymentPurpose?: string;
  comments?: string;
}

export interface UseTransactionSplitResult {
  split: (transactionId: string, parts: SplitPartInput[]) => Promise<void>;
  unsplit: (transactionId: string) => Promise<void>;
  saving: boolean;
}

export function useTransactionSplit(onDone: () => void | Promise<void>): UseTransactionSplitResult {
  const [saving, setSaving] = useState(false);
  const t = useIntlayer('transactionsDrawer');
  const successText = t.splitToasts.success.value;
  const failedText = t.splitToasts.failed.value;
  const undoneText = t.splitToasts.undone.value;
  const undoFailedText = t.splitToasts.undoFailed.value;

  // Promise chains rather than try/finally: React Compiler skips hooks that
  // contain a `finally` clause.
  const split = useCallback(
    async (transactionId: string, parts: SplitPartInput[]) => {
      setSaving(true);
      await apiClient
        .post(`/transactions/${transactionId}/split`, {
          parts,
        } satisfies ContractInput<'SplitTransactionBody'>)
        .then(async () => {
          toast.success(successText);
          invalidateFinancialData();
          await onDone();
        })
        .catch((error: unknown) => {
          toast.error(getApiErrorMessage(error, failedText));
        });
      setSaving(false);
    },
    [onDone, successText, failedText],
  );

  const unsplit = useCallback(
    async (transactionId: string) => {
      setSaving(true);
      await apiClient
        .post(`/transactions/${transactionId}/unsplit`)
        .then(async () => {
          toast.success(undoneText);
          invalidateFinancialData();
          await onDone();
        })
        .catch((error: unknown) => {
          toast.error(getApiErrorMessage(error, undoFailedText));
        });
      setSaving(false);
    },
    [onDone, undoneText, undoFailedText],
  );

  return { split, unsplit, saving };
}
