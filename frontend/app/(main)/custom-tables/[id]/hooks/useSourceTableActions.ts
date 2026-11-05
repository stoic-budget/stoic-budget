'use client';

import { useCallback, useState } from 'react';
import toast from 'react-hot-toast';
import apiClient from '@/app/lib/api';
import { getApiErrorMessage } from '@/app/lib/api-error';
import { invalidateDocumentLists } from '@/app/lib/invalidate-document-lists';
import { checkContract } from '@/app/lib/query-fn-schema';
import type { buildDetailLabels } from '../labels';

type ToastLabels = ReturnType<typeof buildDetailLabels>['toasts'];

/** Refresh and "Restore to default", for a table filled from app data. */
export function useSourceTableActions({
  tableId,
  reloadTableAndRows,
  onRowsChanged,
  resetView,
  toasts,
}: {
  tableId: string;
  reloadTableAndRows: () => Promise<void>;
  onRowsChanged: () => void;
  /** Clears the view choices kept only on the page. */
  resetView: () => void;
  toasts: ToastLabels;
}) {
  const [refreshing, setRefreshing] = useState(false);
  const runRefreshSource = useCallback(async () => {
    setRefreshing(true);
    await (async () => {
      const response = await apiClient.post(`/custom-tables/${tableId}/refresh-from-source`);
      const result = await checkContract(
        'RefreshedFromSource',
        response.data,
        '/custom-tables/:id/refresh-from-source',
      );
      toast.success(
        toasts.refreshed
          .replace('{{inserted}}', String(result.inserted))
          .replace('{{updated}}', String(result.updated)),
      );
      await reloadTableAndRows();
      onRowsChanged();
    })()
      .catch(async error => {
        console.error('Failed to refresh table from source:', error);
        toast.error(getApiErrorMessage(error, toasts.refreshFailed));
      })
      .finally(async () => setRefreshing(false));
  }, [tableId, reloadTableAndRows, onRowsChanged, toasts]);

  // "Restore to default": undo the table's app changes and rebuild it from the source.
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const runRestoreDefault = useCallback(async () => {
    setRestoring(true);
    await (async () => {
      const response = await apiClient.post(`/custom-tables/${tableId}/restore-default`);
      const result = await checkContract(
        'RestoredTableDefault',
        response.data,
        '/custom-tables/:id/restore-default',
      );
      toast.success(toasts.restored.replace('{{reverted}}', String(result.reverted)));
      if (result.skippedChanged) {
        toast(toasts.restoredSkipped.replace('{{count}}', String(result.skippedChanged)));
      }
      if (result.failed.length) {
        toast.error(toasts.restoredFailed.replace('{{count}}', String(result.failed.length)));
      }
      // The view settings the server just cleared, and the ones kept only here.
      // The restore changed app records back: drop cached document lists too.
      invalidateDocumentLists();
      resetView();
      await reloadTableAndRows();
      onRowsChanged();
    })()
      .catch(async error => {
        console.error('Failed to restore table to default:', error);
        toast.error(getApiErrorMessage(error, toasts.restoreFailed));
      })
      .finally(async () => {
        setRestoring(false);
        setRestoreOpen(false);
      });
  }, [tableId, reloadTableAndRows, onRowsChanged, resetView, toasts]);

  return {
    refreshing,
    runRefreshSource,
    restoreOpen,
    setRestoreOpen,
    restoring,
    runRestoreDefault,
  };
}
