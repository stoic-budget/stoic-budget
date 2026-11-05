'use client';

import MenuList from '@mui/material/MenuList';
import { useState } from 'react';

import { MoreHorizontal, SlidersHorizontal } from '@/app/components/icons';
import { Button } from '@/app/components/ui/button';
import { DrawerShell } from '@/app/components/ui/drawer-shell';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/app/components/ui/dropdown-menu';

import type { TableToolbarProps } from './TableToolbar';

/** Grouping and column visibility, behind one quiet "View" button that opens a side panel. */
export function ViewMenu({
  columns,
  columnVisibility,
  onColumnVisibilityChange,
  groupBy,
  onGroupByChange,
  labels,
}: Pick<
  TableToolbarProps,
  | 'columns'
  | 'columnVisibility'
  | 'onColumnVisibilityChange'
  | 'groupBy'
  | 'onGroupByChange'
  | 'labels'
>) {
  const hidden = columns.filter(column => columnVisibility[column.key] === false);
  const groupable = columns.filter(column => column.type !== 'formula' && column.type !== 'ai');
  const changes = hidden.length + (groupBy ? 1 : 0);
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="ghost" size="sm" type="button" onClick={() => setOpen(true)}>
        <SlidersHorizontal size={16} aria-hidden />
        {labels.view}
        {changes ? <span className="seneca-grid__menu-count">{changes}</span> : null}
      </Button>
      <DrawerShell isOpen={open} onClose={() => setOpen(false)} title={labels.view} width="sm">
        {/* MenuList walks its children for focus; a Fragment hides them, so give it arrays. */}
        <MenuList>
          <DropdownMenuLabel>{labels.groupBy}</DropdownMenuLabel>
          {[{ key: '', title: labels.groupNone }, ...groupable].map(column => (
            <DropdownMenuCheckboxItem
              key={`group-${column.key}`}
              checked={(groupBy ?? '') === column.key}
              onCheckedChange={() => onGroupByChange(column.key || null)}
            >
              {column.title}
            </DropdownMenuCheckboxItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuLabel>{labels.columns}</DropdownMenuLabel>
          {columns.map(column => (
            <DropdownMenuCheckboxItem
              key={column.key}
              checked={columnVisibility[column.key] !== false}
              onCheckedChange={visible =>
                onColumnVisibilityChange({ ...columnVisibility, [column.key]: visible })
              }
            >
              {column.title}
            </DropdownMenuCheckboxItem>
          ))}
          {hidden.length
            ? [
                <DropdownMenuSeparator key="separator" />,
                <DropdownMenuItem key="show-all" onClick={() => onColumnVisibilityChange({})}>
                  {labels.showAllColumns}
                </DropdownMenuItem>,
              ]
            : null}
        </MenuList>
      </DrawerShell>
    </>
  );
}

/** Rarely used actions: import, export, sync and schema changes. */
export function MoreMenu({
  exporting,
  refreshing,
  onImport,
  onExport,
  onRefreshSource,
  onSendToStatements,
  onAddColumn,
  onAddSummary,
  onRestoreDefault,
  labels,
}: Pick<
  TableToolbarProps,
  | 'exporting'
  | 'refreshing'
  | 'onExport'
  | 'onRefreshSource'
  | 'onSendToStatements'
  | 'onAddColumn'
  | 'onAddSummary'
  | 'onRestoreDefault'
  | 'labels'
> & { onImport: () => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" type="button" aria-label={labels.more}>
          <MoreHorizontal size={18} aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onImport}>{labels.importFile}</DropdownMenuItem>
        {onRefreshSource ? (
          <DropdownMenuItem disabled={refreshing} onClick={onRefreshSource}>
            {labels.refreshSource}
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuItem onClick={onSendToStatements}>{labels.sendToStatements}</DropdownMenuItem>
        <DropdownMenuItem onClick={onAddColumn}>{labels.addColumn}</DropdownMenuItem>
        <DropdownMenuItem onClick={onAddSummary}>{labels.addSummary}</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>{labels.export}</DropdownMenuLabel>
        <DropdownMenuItem disabled={exporting} onClick={() => onExport('xlsx')}>
          {labels.exportXlsx}
        </DropdownMenuItem>
        <DropdownMenuItem disabled={exporting} onClick={() => onExport('csv')}>
          {labels.exportCsv}
        </DropdownMenuItem>
        {/* MUI Menu walks its children for focus; a Fragment hides them, so give it an array. */}
        {onRestoreDefault
          ? [
              <DropdownMenuSeparator key="restore-separator" />,
              <DropdownMenuItem
                key="restore"
                className="seneca-ct__menu-item--danger"
                onClick={onRestoreDefault}
              >
                {labels.restoreDefault}
              </DropdownMenuItem>,
            ]
          : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
