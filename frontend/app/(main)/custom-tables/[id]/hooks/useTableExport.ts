'use client';

import type { SortingState } from '@tanstack/react-table';
import { useCallback, useState } from 'react';
import toast from 'react-hot-toast';
import { getApiErrorMessage } from '@/app/lib/api-error';
import { type CustomTableExportParams, downloadTableExport } from '../../exportTable';
import type { CustomTableColumn } from '../utils/types';
import { sortParam } from './useTableViewState';

/** Downloads the table as it is on screen: same filters, sort and visible columns. */
export function useTableExport({
  tableId,
  sorting,
  columns,
  columnVisibility,
  filtersParam,
  exportFailedMessage,
}: {
  tableId: string;
  sorting: SortingState;
  columns: CustomTableColumn[];
  columnVisibility: Record<string, boolean>;
  filtersParam: CustomTableExportParams['filters'];
  exportFailedMessage: string;
}) {
  const [exporting, setExporting] = useState(false);
  const exportView = useCallback(
    async (format: 'xlsx' | 'csv') => {
      setExporting(true);
      const sort = sortParam(sorting);
      const visible = columns.filter(c => columnVisibility[c.key] !== false).map(c => c.key);
      await downloadTableExport(tableId, format, {
        filters: filtersParam,
        sort: sort ? JSON.stringify(sort) : undefined,
        columnKeys: visible,
      })
        .catch(error => {
          console.error('Failed to export table:', error);
          toast.error(getApiErrorMessage(error, exportFailedMessage));
        })
        .finally(() => setExporting(false));
    },
    [tableId, sorting, columns, columnVisibility, filtersParam, exportFailedMessage],
  );
  return { exporting, exportView };
}
