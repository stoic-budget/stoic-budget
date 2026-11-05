'use client';

import { useCallback, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import apiClient from '@/app/lib/api';
import { getApiErrorMessage } from '@/app/lib/api-error';
import { isDraftRowId } from '../helpers/draftRowHelpers';
import type { CustomTableColumn, CustomTableGridRow } from '../utils/types';

interface PendingDelete {
  kind: 'rows' | 'column';
  column?: CustomTableColumn;
}

/** The delete confirmation, for the selected rows or a single column. */
export function useTableDeletion({
  tableId,
  rowSelection,
  setRowSelection,
  setRows,
  deleteColumn,
  onRowsChanged,
  messages,
}: {
  tableId: string;
  rowSelection: Record<string, true>;
  setRowSelection: (next: Record<string, true>) => void;
  setRows: React.Dispatch<React.SetStateAction<CustomTableGridRow[]>>;
  deleteColumn: (column: CustomTableColumn) => Promise<void>;
  onRowsChanged: () => void;
  messages: { rowsDeleted: string; rowsDeleteFailed: string };
}) {
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);
  const selectedIds = useMemo(() => Object.keys(rowSelection), [rowSelection]);
  const confirmDelete = useCallback(async () => {
    if (!pendingDelete) {
      return;
    }
    if (pendingDelete.kind === 'column' && pendingDelete.column) {
      await deleteColumn(pendingDelete.column);
      setPendingDelete(null);
      return;
    }
    await (async () => {
      await Promise.all(
        // Drafts were never saved, so the server has nothing to delete.
        selectedIds
          .filter(id => !isDraftRowId(id))
          .map(id => apiClient.delete(`/custom-tables/${tableId}/rows/${id}`)),
      );
      setRows(prev => prev.filter(row => !selectedIds.includes(row.id)));
      setRowSelection({});
      toast.success(messages.rowsDeleted.replace('{{count}}', String(selectedIds.length)));
      onRowsChanged();
    })().catch(async error => {
      console.error('Failed to delete rows:', error);
      toast.error(getApiErrorMessage(error, messages.rowsDeleteFailed));
    });
    setPendingDelete(null);
  }, [
    pendingDelete,
    selectedIds,
    tableId,
    setRows,
    setRowSelection,
    deleteColumn,
    onRowsChanged,
    messages.rowsDeleted,
    messages.rowsDeleteFailed,
  ]);
  return { pendingDelete, setPendingDelete, selectedIds, confirmDelete };
}
