'use client';

import type { SortingState } from '@tanstack/react-table';
import { useEffect, useRef } from 'react';
import { DataGrid, useDataGrid } from '@/app/components/data-grid';
import { Plus } from '@/app/components/icons';

import { useFillViewport } from '../hooks/useFillViewport';
import { useGridColumns } from '../hooks/useGridColumns';

import { type AggregateFn, type CustomTableColumn, type CustomTableGridRow } from '../utils/types';
import { type ColumnHeaderLabels } from './ColumnHeader';
import { type CellLabels, type UpdateCellFn } from './cells/EditableCell';

export interface TableGridLabels extends CellLabels, ColumnHeaderLabels {
  selectAll: string;
  selectRow: string;
  rowNumber: string;
  addRow: string;
  emptyTitle: string;
  emptySubtitle: string;
  noTotal: string;
  aggregates: Record<AggregateFn, string>;
  caption: string;
}

export interface TableGridProps {
  columns: CustomTableColumn[];
  rows: CustomTableGridRow[];
  loading: boolean;
  /** Placeholder rows drawn while the first page of rows loads. */
  skeletonRows?: number;
  hasMore: boolean;
  fallbackCurrency: string;
  /** The source of a table filled from app data; its cells write back to the records. */
  sourceKind?: string | null;
  sorting: SortingState;
  onSortingChange: (next: SortingState) => void;
  rowSelection: Record<string, true>;
  onRowSelectionChange: (next: Record<string, true>) => void;
  columnVisibility: Record<string, boolean>;
  onColumnVisibilityChange: (next: Record<string, boolean>) => void;
  aggregates: Record<string, AggregateFn>;
  aggregateValues: Record<string, number | string | null>;
  onAggregateChange: (columnKey: string, fn: AggregateFn | null) => void;
  onUpdateCell: UpdateCellFn;
  onAddRow: () => void;
  /** A row just added: the grid scrolls to it and focuses its first cell. */
  revealRowId?: string | null;
  onLoadMore: () => void;
  onEditColumn: (column: CustomTableColumn) => void;
  onDeleteColumn: (column: CustomTableColumn) => void;
  labels: TableGridLabels;
}

export const ROW_HEIGHT = 44;

/** The table body: columns come from the custom table, rows from the server. */
export function TableGrid(props: TableGridProps) {
  const { rows, loading, hasMore, sorting, rowSelection, columnVisibility, labels } = props;
  const gridColumns = useGridColumns(props);
  const table = useDataGrid<CustomTableGridRow>({
    data: rows,
    columns: gridColumns,
    getRowId: row => row.id,
    state: { sorting, rowSelection, columnVisibility },
    onSortingChange: updater =>
      props.onSortingChange(typeof updater === 'function' ? updater(sorting) : updater),
    onRowSelectionChange: updater =>
      props.onRowSelectionChange(typeof updater === 'function' ? updater(rowSelection) : updater),
    onColumnVisibilityChange: updater =>
      props.onColumnVisibilityChange(
        typeof updater === 'function' ? updater(columnVisibility) : updater,
      ),
    manualSorting: true,
    enableRowSelection: true,
  });
  // The totals strip shows only once a column has a total; it is picked in the column menu.
  const hasTotals = Object.values(props.aggregates).some(Boolean);
  const selecting = Object.keys(rowSelection).length > 0;
  const [frameRef, fillHeight] = useFillViewport<HTMLDivElement>();
  const frame = useRef<HTMLDivElement | null>(null);
  const { revealRowId } = props;
  const revealReady = Boolean(revealRowId && rows.some(row => row.id === revealRowId));

  // A new row lands at the end of the loaded rows, usually far below the fold.
  // Scroll there, then focus its first cell once the virtualizer has drawn it.
  useEffect(() => {
    const scroller = frame.current?.querySelector<HTMLElement>('.seneca-grid__scroll');
    if (!(revealReady && scroller)) {
      return;
    }
    scroller.scrollTop = scroller.scrollHeight;
    let frameId = requestAnimationFrame(() => {
      frameId = requestAnimationFrame(() => {
        frame.current
          ?.querySelector<HTMLElement>('.seneca-ct__row--new .seneca-ct__cell-button')
          ?.focus();
      });
    });
    return () => cancelAnimationFrame(frameId);
  }, [revealReady, revealRowId]);

  return (
    <div
      ref={node => {
        frame.current = node;
        frameRef(node);
      }}
    >
      <DataGrid
        table={table}
        caption={labels.caption}
        loading={loading}
        skeletonRows={props.skeletonRows}
        className={`seneca-ct__grid${selecting ? ' seneca-ct__grid--selecting' : ''}`}
        maxHeight={fillHeight ?? 'calc(100vh - var(--global-nav-height, 0px) - 232px)'}
        virtualization={{ rowHeight: ROW_HEIGHT }}
        rowClassName={row => (row.id === revealRowId ? 'seneca-ct__row--new' : undefined)}
        onEndReached={hasMore && !loading ? props.onLoadMore : undefined}
        showFooter={hasTotals}
        emptyState={
          <div className="seneca-ct__empty">
            <strong>{labels.emptyTitle}</strong>
            <span>{labels.emptySubtitle}</span>
          </div>
        }
        trailing={
          <tr className="seneca-ct__add-row">
            <td colSpan={table.getVisibleLeafColumns().length}>
              <button type="button" className="seneca-ct__add-row-btn" onClick={props.onAddRow}>
                <Plus size={14} aria-hidden />
                {labels.addRow}
              </button>
            </td>
          </tr>
        }
      />
    </div>
  );
}
