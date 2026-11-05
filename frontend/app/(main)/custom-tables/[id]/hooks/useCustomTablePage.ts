'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useWorkspace } from '@/app/contexts/WorkspaceContext';
import { useAuth } from '@/app/hooks/useAuth';
import { useIntlayer } from '@/app/i18n';
import apiClient from '@/app/lib/api';
import { getApiErrorMessage } from '@/app/lib/api-error';
import { resolveCurrencyCode } from '@/app/lib/format-money';
import type { ContractInput } from '@/app/lib/query-fn-schema';
import { showUndoToast } from '../components/UndoToast';
import { buildDetailLabels } from '../labels';
import { useAggregateSelection } from './useAggregateSelection';
import { useColumnEditor } from './useColumnEditor';
import { useConvertToStatement } from './useConvertToStatement';
import { usePasteImport } from './usePasteImport';
import { useRelationTargets } from './useRelationTargets';
import { useRowFilters } from './useRowFilters';
import { useRowMutations } from './useRowMutations';
import { useSourceTableActions } from './useSourceTableActions';
import { useTableAggregates } from './useTableAggregates';
import { useTableData } from './useTableData';
import { useTableDeletion } from './useTableDeletion';
import { useTableExport } from './useTableExport';
import { useTableGrid } from './useTableGrid';
import { useTableGroups } from './useTableGroups';
import { useTableMoneyTotal } from './useTableMoneyTotal';
import { useTableSummaries } from './useTableSummaries';
import { sortParam, useColumnVisibility, useTableSorting } from './useTableViewState';

/** Everything the table page needs, composed from the data hooks. */
export function useCustomTablePage(tableId: string) {
  const t = useIntlayer('customTableDetailPage');
  const labels = useMemo(() => buildDetailLabels(t), [t]);
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const isAuthenticated = Boolean(user);
  const { currentWorkspace } = useWorkspace();
  const defaultCurrency = resolveCurrencyCode(currentWorkspace?.currency);

  const data = useTableData({
    tableId,
    isAuthenticated,
    authLoading,
    loadTableFailedMessage: labels.toasts.loadTableFailed,
  });
  const columns = useMemo(
    () => [...(data.table?.columns ?? [])].sort((a, b) => a.position - b.position),
    [data.table],
  );

  const filters = useRowFilters();
  const isSourceTable = Boolean(data.table?.sourceBinding);
  const { sorting, setSorting } = useTableSorting(tableId, columns, isSourceTable);
  const grid = useTableGrid({
    tableId,
    // The first page is asked once the table is known, so it comes already in
    // the order the table opens with, not re-sorted a moment later.
    isAuthenticated: isAuthenticated && Boolean(data.table),
    combinedFiltersParam: filters.filtersParam,
    sort: sortParam(sorting),
    loadRowsFailedMessage: labels.toasts.loadRowsFailed,
  });

  const [rowSelection, setRowSelection] = useState<Record<string, true>>({});
  const { columnVisibility, setColumnVisibility } = useColumnVisibility(
    columns,
    grid.rows,
    isSourceTable,
  );
  const [refreshToken, setRefreshToken] = useState(0);
  const onRowsChanged = useCallback(() => setRefreshToken(n => n + 1), []);

  const { aggregates, setAggregates, setAggregate } = useAggregateSelection(
    tableId,
    data.table?.viewSettings?.columns,
  );

  const aggregateState = useTableAggregates({
    tableId,
    isAuthenticated,
    combinedFiltersParam: filters.filtersParam,
    selection: aggregates,
    refreshToken,
  });
  const moneyTotal = useTableMoneyTotal({ tableId, isAuthenticated, refreshToken });
  const summaries = useTableSummaries({
    tableId,
    isAuthenticated,
    refreshToken,
    messages: {
      loadFailed: labels.summaries.loadFailed,
      saveFailed: labels.summaries.saveFailed,
    },
  });
  const [groupBy, setGroupBy] = useState<string | null>(null);
  const groupState = useTableGroups({
    tableId,
    isAuthenticated,
    groupBy,
    combinedFiltersParam: filters.filtersParam,
    aggregates,
    refreshToken,
  });

  const mutations = useRowMutations({
    tableId,
    columns,
    rows: grid.rows,
    setRows: grid.setRows,
    onRowsChanged,
    messages: labels.toasts,
  });

  // A new or changed formula column changes every row: reload them with the table.
  const reloadTableAndRows = useCallback(async () => {
    await data.loadTable();
    await grid.loadRows({ reset: true });
  }, [data.loadTable, grid.loadRows]);

  const columnEditor = useColumnEditor({
    tableId,
    defaultCurrency,
    reloadTable: reloadTableAndRows,
    messages: {
      saved: labels.toasts.columnSaved,
      saveFailed: labels.toasts.columnSaveFailed,
      deleted: labels.toasts.columnDeleted,
      deleteFailed: labels.toasts.columnDeleteFailed,
    },
  });

  const onInsertSuccess = useCallback(
    (
      { createdCount, issueCount }: { createdCount: number; issueCount: number },
      onUndo: () => void,
    ) =>
      showUndoToast(
        (issueCount ? labels.import.insertedWithIssues : labels.import.inserted)
          .replace('{{count}}', String(createdCount))
          .replace('{{issues}}', String(issueCount)),
        labels.import.undo,
        onUndo,
      ),
    [labels.import.inserted, labels.import.insertedWithIssues, labels.import.undo],
  );

  const paste = usePasteImport({
    tableId,
    orderedColumns: data.table?.columns ?? [],
    pasteDefaults: labels.import.defaults,
    loadTable: data.loadTable,
    onRowsChanged,
    setRows: grid.setRows,
    onInsertSuccess,
    messages: labels.import,
  });

  const { exporting, exportView } = useTableExport({
    tableId,
    sorting,
    columns,
    columnVisibility,
    filtersParam: filters.filtersParam,
    exportFailedMessage: labels.toasts.exportFailed,
  });

  const { convert, setConvert, runConvert } = useConvertToStatement(tableId, labels.convert.failed);

  const sourceActions = useSourceTableActions({
    tableId,
    reloadTableAndRows,
    onRowsChanged,
    resetView: () => {
      setAggregates({});
      setGroupBy(null);
      setSorting([]);
      setColumnVisibility({});
      setRowSelection({});
      filters.clearFilters();
      filters.setSearchQuery('');
    },
    toasts: labels.toasts,
  });

  const { pendingDelete, setPendingDelete, selectedIds, confirmDelete } = useTableDeletion({
    tableId,
    rowSelection,
    setRowSelection,
    setRows: grid.setRows,
    deleteColumn: columnEditor.deleteColumn,
    onRowsChanged,
    messages: labels.toasts,
  });

  const rename = useCallback(
    async (name: string) => {
      await (async () => {
        await apiClient.patch(`/custom-tables/${tableId}`, {
          name,
        } satisfies ContractInput<'UpdateCustomTableBody'>);
        data.setTable(prev => (prev ? { ...prev, name } : prev));
        toast.success(labels.toasts.renamed);
      })().catch(async error => {
        toast.error(getApiErrorMessage(error, labels.toasts.renameFailed));
      });
    },
    [tableId, data, labels.toasts.renamed, labels.toasts.renameFailed],
  );

  const relationTargets = useRelationTargets(tableId, columnEditor.dialog.mode !== 'closed');

  const pickGroup = useCallback(
    (key: string | null) => {
      if (!groupBy) {
        return;
      }
      filters.addFilter(
        key === null ? { col: groupBy, op: 'isEmpty' } : { col: groupBy, op: 'eq', value: key },
      );
    },
    [groupBy, filters],
  );

  return {
    labels,
    router,
    defaultCurrency,
    data,
    columns,
    filters,
    sorting,
    setSorting,
    grid,
    rowSelection,
    setRowSelection,
    columnVisibility,
    setColumnVisibility,
    aggregates,
    aggregateValues: aggregateState.values,
    setAggregate,
    moneyTotal,
    groupBy,
    setGroupBy,
    groups: groupState,
    pickGroup,
    mutations,
    columnEditor,
    relationTargets,
    paste,
    exporting,
    exportView,
    convert,
    setConvert,
    runConvert,
    ...sourceActions,
    summaries,
    pendingDelete,
    setPendingDelete,
    selectedIds,
    confirmDelete,
    rename,
  };
}

export type CustomTablePageState = ReturnType<typeof useCustomTablePage>;
