'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { useWorkspaceId } from '@/app/hooks/useWorkspaceId';
import { DUPLICATE_EXPENSE_HREF, stashManualPrefill } from '@/app/lib/manual-expense-prefill';
import { apiQueryDecoded } from '@/app/lib/query-fn-schema';
import { queryKeys } from '@/app/lib/query-keys';
import { duplicateDraft } from '../helpers/duplicate-draft';
import type { Transaction } from '../types';

type Categories = Parameters<typeof duplicateDraft>[1];

/**
 * Opens the manual expense form filled in from a row. Nothing is sent: the
 * accounts are read (from the cache when the form's own field has them) only
 * to keep an account the form can offer.
 *
 * Answers whether it went to the form. It does not when the place it was asked
 * from is gone by the time the accounts arrive (closed, or the person moved on
 * to another page), and a second click while the first is under way is ignored.
 */
export function useDuplicateTransaction(categories: Categories) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const workspaceId = useWorkspaceId();
  const mounted = useRef(true);
  const busy = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  return async (tx: Transaction): Promise<boolean> => {
    if (busy.current) {
      return false;
    }
    busy.current = true;
    const askedFrom = window.location.href;
    const accounts = await queryClient
      .ensureQueryData({
        queryKey: queryKeys.wallets(workspaceId),
        queryFn: ({ signal }) =>
          apiQueryDecoded({ url: '/wallets', signal, contract: 'WalletList' }),
      })
      .catch(() => []);
    busy.current = false;
    if (!mounted.current || window.location.href !== askedFrom) {
      return false;
    }
    stashManualPrefill(duplicateDraft(tx, categories, accounts));
    router.push(DUPLICATE_EXPENSE_HREF);
    return true;
  };
}
