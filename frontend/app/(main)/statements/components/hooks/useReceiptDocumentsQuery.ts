'use client';

import { type UseQueryResult, useQuery } from '@tanstack/react-query';
import { useCallback } from 'react';
import { useWorkspaceId } from '@/app/hooks/useWorkspaceId';
import { receiptDocumentsApi } from '@/app/lib/api';
import { fetchAllPages } from '@/app/lib/fetch-all-pages';
import { queryKeys } from '@/app/lib/query-keys';
import { hasReceiptAmount, type ReceiptDocument } from '../receipt-document-mapping';

const POLL_INTERVAL_MS = 6000;
/** The most the server answers in one request. */
const RECEIPTS_PER_REQUEST = 100;

export interface UseReceiptDocumentsQueryParams {
  categoryId?: string | null;
  receiptStatus?: string | null;
  enabled: boolean;
}

export function useReceiptDocumentsQuery({
  categoryId,
  receiptStatus,
  enabled,
}: UseReceiptDocumentsQueryParams): UseQueryResult<ReceiptDocument[], Error> {
  const workspaceId = useWorkspaceId();
  // Every receipt, not one server page: the list merges them with the statements
  // and pages the whole on the client, so one server page showed at most 30.
  const params = {
    includeInvalid: false,
    // Scans without a recognised amount still belong in the list (as "Needs review").
    includeLinkedScans: true,
    ...(categoryId ? { categoryId } : {}),
    ...(receiptStatus ? { status: receiptStatus } : {}),
  };

  // When a specific status is requested (e.g. needs_review), show all matching
  // receipts regardless of whether an amount was parsed. Otherwise filter to
  // amount-present only.
  //
  // select обязан быть стабильным по ссылке: инлайн-стрелка пересчитывала бы
  // фильтр на каждый рендер и отдавала новый массив, отменяя structural sharing.
  const selectByAmount = useCallback(
    (receipts: ReceiptDocument[]): ReceiptDocument[] =>
      receiptStatus ? receipts : receipts.filter(hasReceiptAmount),
    [receiptStatus],
  );

  return useQuery({
    queryKey: queryKeys.receiptDocuments({ workspaceId, params }),
    // Сырой список кладётся в кэш нефильтрованным, поэтому смена receiptStatus
    // меняет только select и не вызывает повторный запрос.
    queryFn: () =>
      fetchAllPages<ReceiptDocument>(RECEIPTS_PER_REQUEST, async (_page, offset) => {
        const response = await receiptDocumentsApi.listReceipts({
          ...params,
          limit: RECEIPTS_PER_REQUEST,
          offset,
        });
        const receipts = Array.isArray(response.data?.receipts) ? response.data.receipts : [];
        const total = Number(response.data?.total);
        return { items: receipts, total: Number.isFinite(total) ? total : receipts.length };
      }),
    enabled: enabled && Boolean(workspaceId),
    refetchInterval: POLL_INTERVAL_MS,
    select: selectByAmount,
  });
}
