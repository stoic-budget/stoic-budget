'use client';

import type { SortingState } from '@tanstack/react-table';
import { useCallback, useMemo, useState } from 'react';
import { sourceViewDefaults } from '../utils/source-view-defaults';
import type { CustomTableColumn, CustomTableGridRow } from '../utils/types';

export const sortParam = (sorting: SortingState) =>
  sorting[0]
    ? { col: sorting[0].id, dir: sorting[0].desc ? ('desc' as const) : ('asc' as const) }
    : null;

/**
 * A table filled from Seneca opens newest first and without the columns that
 * repeat the row (type, statement, a single currency). These defaults are
 * derived during render, never set in an effect after the rows arrive: that
 * re-sorted an already drawn table, emptied it and drew it again, so the old
 * layout flashed after the skeleton. Whatever the user picks overrides them.
 */
export function useTableSorting(
  tableId: string,
  columns: CustomTableColumn[],
  isSourceTable: boolean,
) {
  const defaultSorting = useMemo(
    () => (isSourceTable ? sourceViewDefaults(columns, []).sorting : []),
    [isSourceTable, columns],
  );
  const [userSorting, setUserSorting] = useState<{ tableId: string; value: SortingState } | null>(
    null,
  );
  const sorting =
    userSorting && userSorting.tableId === tableId ? userSorting.value : defaultSorting;
  const setSorting = useCallback(
    (updater: SortingState | ((current: SortingState) => SortingState)) =>
      setUserSorting(prev => {
        const current = prev && prev.tableId === tableId ? prev.value : defaultSorting;
        return {
          tableId: tableId ?? '',
          value: typeof updater === 'function' ? updater(current) : updater,
        };
      }),
    [tableId, defaultSorting],
  );
  return { sorting, setSorting };
}

export function useColumnVisibility(
  columns: CustomTableColumn[],
  rows: CustomTableGridRow[],
  isSourceTable: boolean,
) {
  const [userVisibility, setUserVisibility] = useState<Record<string, boolean>>({});
  // The currency column hides while every loaded row has one currency (and
  // before any row is in, the usual case), so it does not pop out on arrival.
  const defaultHidden = useMemo(
    () => (isSourceTable ? sourceViewDefaults(columns, rows, { assumeSingle: true }).hidden : []),
    [isSourceTable, columns, rows],
  );
  const columnVisibility = useMemo(
    () => ({ ...Object.fromEntries(defaultHidden.map(key => [key, false])), ...userVisibility }),
    [defaultHidden, userVisibility],
  );
  const setColumnVisibility = useCallback(
    (
      updater:
        | Record<string, boolean>
        | ((current: Record<string, boolean>) => Record<string, boolean>),
    ) =>
      setUserVisibility(prev =>
        typeof updater === 'function'
          ? updater({ ...Object.fromEntries(defaultHidden.map(key => [key, false])), ...prev })
          : updater,
      ),
    [defaultHidden],
  );
  return { columnVisibility, setColumnVisibility };
}
