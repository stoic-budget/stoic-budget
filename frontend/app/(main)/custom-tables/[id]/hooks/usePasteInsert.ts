'use client';

import { useCallback, useState } from 'react';
import toast from 'react-hot-toast';
import apiClient from '@/app/lib/api';
import { getApiErrorMessage } from '@/app/lib/api-error';
import { type ContractInput, checkContract } from '@/app/lib/query-fn-schema';
import type { PasteProgress, UsePasteImportParams } from '../utils/pasteImportTypes';
import {
  applySummaries,
  applyTotals,
  buildPayloadRows,
  countIssues,
  createNewColumns,
  mergeCreatedRows,
} from '../utils/pasteInsert';
import type { PastePreviewData } from '../utils/pasteUtils';
import { toGridRow } from '../utils/tableHelpers';
import type { CustomTableGridRow } from '../utils/types';

/** Строк в одном запросе: сервер принимает до 1000, а прогресс приятнее видеть чаще. */
const CHUNK_SIZE = 500;
const ROLLBACK_PARALLEL = 25;

type UsePasteInsertParams = Pick<
  UsePasteImportParams,
  'tableId' | 'loadTable' | 'onRowsChanged' | 'setRows' | 'onInsertSuccess' | 'messages'
> & {
  pastePreview: PastePreviewData | null;
  pasteSummaries: PastePreviewData['summaries'];
  resetPreview: () => void;
};

/** Sends a built preview to the server, and takes it back when the user presses undo. */
export function usePasteInsert({
  tableId,
  pastePreview,
  pasteSummaries,
  resetPreview,
  loadTable,
  onRowsChanged,
  setRows,
  onInsertSuccess,
  messages,
}: UsePasteInsertParams) {
  const [pasteApplying, setPasteApplying] = useState(false);
  const [pasteApplyTotals, setPasteApplyTotals] = useState(true);
  const [pasteProgress, setPasteProgress] = useState<PasteProgress | null>(null);

  const resetPastePreview = useCallback(() => {
    resetPreview();
    setPasteApplying(false);
    setPasteApplyTotals(true);
    setPasteProgress(null);
  }, [resetPreview]);

  const appendRows = useCallback(
    (createdRows: CustomTableGridRow[]) => {
      setRows(prev => mergeCreatedRows(prev, createdRows));
    },
    [setRows],
  );

  /** Откат импорта: строки пачками, затем колонки, которые он же и создал. */
  const rollback = useCallback(
    async (rowIds: string[], columnIds: string[]) => {
      if (!tableId) {
        return;
      }
      await (async () => {
        for (let index = 0; index < rowIds.length; index += ROLLBACK_PARALLEL) {
          await Promise.all(
            rowIds
              .slice(index, index + ROLLBACK_PARALLEL)
              .map(rowId => apiClient.delete(`/custom-tables/${tableId}/rows/${rowId}`)),
          );
        }
        for (const columnId of columnIds) {
          await apiClient.delete(`/custom-tables/${tableId}/columns/${columnId}`);
        }
        setRows(prev => prev.filter(row => !rowIds.includes(row.id)));
        if (columnIds.length) {
          await loadTable();
        }
        onRowsChanged();
      })().catch(async error => {
        console.error('Failed to rollback import:', error);
        toast.error(messages.undoFailed);
      });
    },
    [tableId, onRowsChanged, setRows, loadTable, messages.undoFailed],
  );

  const handlePasteAdd = useCallback(async () => {
    if (!(tableId && pastePreview) || pasteApplying) {
      return;
    }
    if (!pastePreview.dataRows.length) {
      toast.error(messages.noRows);
      return;
    }

    const newColumns = pastePreview.columns.filter(col => col.mode === 'new');
    if (newColumns.some(col => !col.newTitle?.trim())) {
      toast.error(messages.missingColumnTitle);
      return;
    }

    setPasteApplying(true);
    const created: CustomTableGridRow[] = [];
    const createdColumnIds: string[] = [];

    await (async () => {
      const { keyMap, columnIds } = await createNewColumns(tableId, newColumns, loadTable);
      createdColumnIds.push(...columnIds);
      const payloadRows = buildPayloadRows(pastePreview.dataRows, pastePreview.rowStyles, keyMap);
      const total = payloadRows.length;
      setPasteProgress({ done: 0, total });
      for (let index = 0; index < total; index += CHUNK_SIZE) {
        const chunk = payloadRows.slice(index, index + CHUNK_SIZE);
        const response = await apiClient.post(`/custom-tables/${tableId}/rows/batch`, {
          rows: chunk,
        } satisfies ContractInput<'BatchCreateCustomTableRowsBody'>);
        const batch = await checkContract(
          'CustomTableRowBatch',
          response.data,
          '/custom-tables/:id/rows/batch',
        );
        created.push(...batch.rows.map(toGridRow));
        setPasteProgress({ done: Math.min(index + CHUNK_SIZE, total), total });
      }
      if (pasteApplyTotals) {
        await applyTotals(tableId, pastePreview.totals, keyMap, loadTable);
        await applySummaries(tableId, pasteSummaries);
      }
      // Formula values come from the server after its recalc: reload the rows we appended.
      const hasFormulas = newColumns.some(col => col.newType === 'formula');
      const issueCount = countIssues(pastePreview.rowStyles);
      appendRows(created);
      resetPastePreview();
      onRowsChanged();
      if (hasFormulas) {
        await loadTable();
      }
      onInsertSuccess({ createdCount: created.length || total, issueCount }, () =>
        rollback(created.map(row => row.id).filter(Boolean), createdColumnIds),
      );
    })()
      .catch(async error => {
        // The server names the column and value that stopped the batch; show that, not a generic line.
        toast.error(getApiErrorMessage(error, messages.insertFailed));
        // Часть пачек могла уже войти: покажем их, а не оставим таблицу вразнобой с сервером.
        if (created.length) {
          appendRows(created);
          onRowsChanged();
        }
      })
      .finally(async () => {
        setPasteApplying(false);
        setPasteProgress(null);
      });
  }, [
    tableId,
    pastePreview,
    pasteApplying,
    pasteApplyTotals,
    pasteSummaries,
    appendRows,
    resetPastePreview,
    loadTable,
    onRowsChanged,
    rollback,
    onInsertSuccess,
    messages.noRows,
    messages.missingColumnTitle,
    messages.insertFailed,
  ]);

  return {
    pasteApplying,
    pasteApplyTotals,
    setPasteApplyTotals,
    pasteProgress,
    resetPastePreview,
    handlePasteAdd,
  };
}
