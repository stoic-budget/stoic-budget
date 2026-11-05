'use client';

import { useRef } from 'react';
import { StatementsSearchPopover } from '@/app/(main)/statements/components/filters/StatementsSearchPopover';
import { Maximize, Minimize, Plus, Trash2, X } from '@/app/components/icons';
import { Button } from '@/app/components/ui/button';
import { TABULAR_FILE_ACCEPT } from '../utils/tabularFileReader';
import type { CustomTableColumn } from '../utils/types';
import { MoreMenu, ViewMenu } from './TableToolbarMenus';

export interface TableToolbarLabels {
  searchHint: string;
  apply: string;
  addRow: string;
  addColumn: string;
  columns: string;
  showAllColumns: string;
  groupBy: string;
  groupNone: string;
  importFile: string;
  export: string;
  exportXlsx: string;
  exportCsv: string;
  sendToStatements: string;
  refreshSource: string;
  deleteSelected: string;
  view: string;
  more: string;
  fullscreen: string;
  exitFullscreen: string;
  clearSelection: string;
  addSummary: string;
  restoreDefault: string;
}

export interface TableToolbarProps {
  columns: CustomTableColumn[];
  columnVisibility: Record<string, boolean>;
  onColumnVisibilityChange: (next: Record<string, boolean>) => void;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  groupBy: string | null;
  onGroupByChange: (key: string | null) => void;
  selectedCount: number;
  exporting: boolean;
  expanded: boolean;
  onToggleExpanded: () => void;
  onAddRow: () => void;
  onAddColumn: () => void;
  onAddSummary: () => void;
  /** Only for tables filled from app data: undo the table's app changes and rebuild it. */
  onRestoreDefault?: () => void;
  onImportFile: (file: File) => void;
  onExport: (format: 'xlsx' | 'csv') => void;
  onSendToStatements: () => void;
  /** Only for tables filled from app data. */
  onRefreshSource?: () => void;
  refreshing?: boolean;
  onDeleteSelected: () => void;
  onClearSelection: () => void;
  /** Filter button and chips, rendered next to the search box. */
  filters?: React.ReactNode;
  labels: TableToolbarLabels;
}

const fill = (template: string, count: number) => template.replace('{{count}}', String(count));

/**
 * Single-row toolbar: the search button and filters on the left, View, the "···" menu and
 * Add row on the right. With rows selected the right side turns into the
 * selection actions.
 */
const GHOST_TOOLBAR_BUTTON: React.CSSProperties = {
  border: '1px solid transparent',
  background: 'transparent',
  fontWeight: 500,
  minHeight: 32,
  padding: '4px 10px',
};

export function TableToolbar(props: TableToolbarProps) {
  const { searchQuery, selectedCount, labels } = props;
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  return (
    <div className="seneca-ct__toolbar">
      <StatementsSearchPopover
        value={searchQuery}
        onApply={props.onSearchChange}
        applyLabel={labels.apply}
        hint={labels.searchHint}
        // Ghost, like Filter, View and "…" beside it: only Add row is filled.
        buttonStyle={GHOST_TOOLBAR_BUTTON}
      />
      {props.filters}
      <input
        ref={fileInputRef}
        type="file"
        accept={TABULAR_FILE_ACCEPT}
        hidden
        data-testid="ct-import-input"
        onChange={event => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (file) {
            props.onImportFile(file);
          }
        }}
      />
      {selectedCount > 0 ? (
        <div className="seneca-ct__actions">
          <Button variant="destructive" size="sm" type="button" onClick={props.onDeleteSelected}>
            <Trash2 size={14} aria-hidden />
            {fill(labels.deleteSelected, selectedCount)}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            type="button"
            aria-label={labels.clearSelection}
            onClick={props.onClearSelection}
          >
            <X size={16} aria-hidden />
          </Button>
        </div>
      ) : (
        <div className="seneca-ct__actions">
          <ViewMenu
            columns={props.columns}
            columnVisibility={props.columnVisibility}
            onColumnVisibilityChange={props.onColumnVisibilityChange}
            groupBy={props.groupBy}
            onGroupByChange={props.onGroupByChange}
            labels={labels}
          />
          <MoreMenu
            exporting={props.exporting}
            refreshing={props.refreshing}
            onImport={() => fileInputRef.current?.click()}
            onExport={props.onExport}
            onRefreshSource={props.onRefreshSource}
            onSendToStatements={props.onSendToStatements}
            onAddColumn={props.onAddColumn}
            onAddSummary={props.onAddSummary}
            onRestoreDefault={props.onRestoreDefault}
            labels={labels}
          />
          <Button
            variant="ghost"
            size="icon"
            type="button"
            className="seneca-ct__fullscreen-toggle"
            aria-label={props.expanded ? labels.exitFullscreen : labels.fullscreen}
            aria-pressed={props.expanded}
            onClick={props.onToggleExpanded}
          >
            {props.expanded ? (
              <Minimize size={18} aria-hidden />
            ) : (
              <Maximize size={18} aria-hidden />
            )}
          </Button>
          {/* On a phone the bottom bar's "+" adds the row. */}
          <Button
            size="sm"
            type="button"
            className="seneca-bottom-bar-source"
            onClick={props.onAddRow}
          >
            <Plus size={18} aria-hidden />
            {labels.addRow}
          </Button>
        </div>
      )}
    </div>
  );
}
