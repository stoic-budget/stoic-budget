import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const post = vi.fn();
const patch = vi.fn();
const remove = vi.fn();
const decoded = vi.fn();
const toastFn = vi.hoisted(() => Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }));
const download = vi.fn();
const invalidateLists = vi.fn();

const data = {
  table: null as unknown,
  setTable: vi.fn(),
  loadTable: vi.fn(async () => {}),
};
const grid = {
  rows: [] as Array<{ id: string }>,
  setRows: vi.fn(),
  loadRows: vi.fn(async () => {}),
};
const filters = {
  filtersParam: 'filters-param',
  addFilter: vi.fn(),
  clearFilters: vi.fn(),
  setSearchQuery: vi.fn(),
};
const columnEditor = {
  dialog: { mode: 'closed' },
  deleteColumn: vi.fn(async () => {}),
};
const aggregateProps = vi.fn((_props: { refreshToken: number }) => ({ values: {} }));

vi.mock('@/app/lib/api', () => ({
  default: {
    post: (...a: unknown[]) => post(...a),
    patch: (...a: unknown[]) => patch(...a),
    delete: (...a: unknown[]) => remove(...a),
  },
}));
vi.mock('@/app/lib/query-fn-schema', () => ({
  checkContract: async (_name: string, payload: unknown) => payload,
  apiQueryDecoded: (...a: unknown[]) => decoded(...a),
}));
vi.mock('react-hot-toast', () => ({ default: toastFn }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@/app/contexts/WorkspaceContext', () => ({
  useWorkspace: () => ({ currentWorkspace: { currency: 'EUR' } }),
}));
vi.mock('@/app/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' }, loading: false }) }));
vi.mock('@/app/i18n', () => ({ useIntlayer: () => ({}) }));
vi.mock('@/app/lib/invalidate-document-lists', () => ({
  invalidateDocumentLists: () => invalidateLists(),
}));
vi.mock('../../exportTable', () => ({ downloadTableExport: (...a: unknown[]) => download(...a) }));
vi.mock('../components/UndoToast', () => ({ showUndoToast: vi.fn() }));
vi.mock('../labels', () => ({
  buildDetailLabels: () => ({
    import: { defaults: {} },
    summaries: { loadFailed: 'x', saveFailed: 'x' },
    convert: { failed: 'convert failed' },
    toasts: {
      exportFailed: 'export failed',
      refreshed: 'refreshed {{inserted}}/{{updated}}',
      refreshFailed: 'refresh failed',
      restored: 'restored {{reverted}}',
      restoredSkipped: 'skipped {{count}}',
      restoredFailed: 'not restored {{count}}',
      restoreFailed: 'restore failed',
      rowsDeleted: 'deleted {{count}}',
      rowsDeleteFailed: 'delete failed',
      renamed: 'renamed',
      renameFailed: 'rename failed',
    },
  }),
}));
vi.mock('./useTableData', () => ({ useTableData: () => data }));
vi.mock('./useTableGrid', () => ({ useTableGrid: () => grid }));
vi.mock('./useRowFilters', () => ({ useRowFilters: () => filters }));
vi.mock('./useRowMutations', () => ({ useRowMutations: () => ({}) }));
vi.mock('./useColumnEditor', () => ({ useColumnEditor: () => columnEditor }));
vi.mock('./usePasteImport', () => ({ usePasteImport: () => ({}) }));
vi.mock('./useTableAggregates', () => ({
  useTableAggregates: (props: { refreshToken: number }) => aggregateProps(props),
}));
vi.mock('./useTableGroups', () => ({ useTableGroups: () => ({}) }));
vi.mock('./useTableMoneyTotal', () => ({ useTableMoneyTotal: () => ({}) }));
vi.mock('./useTableSummaries', () => ({ useTableSummaries: () => ({}) }));

import { DRAFT_ROW_ID_PREFIX } from '../helpers/draftRowHelpers';
import { useCustomTablePage } from './useCustomTablePage';

const COLUMNS = [
  { key: 'b', title: 'Second', type: 'text', position: 2 },
  { key: 'a', title: 'First', type: 'text', position: 1 },
];
const render = () => renderHook(() => useCustomTablePage('t1'));
const lastRefreshToken = () => aggregateProps.mock.lastCall?.[0].refreshToken;

describe('useCustomTablePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    data.table = { id: 't1', columns: COLUMNS };
    grid.rows = [];
    columnEditor.dialog = { mode: 'closed' };
    post.mockReset().mockResolvedValue({ data: {} });
    patch.mockReset().mockResolvedValue({ data: {} });
    remove.mockReset().mockResolvedValue({ data: {} });
    decoded.mockReset().mockResolvedValue({ items: [] });
    download.mockReset().mockResolvedValue(undefined);
  });

  it('orders columns by position and keeps the sort the user picked', () => {
    const { result } = render();
    expect(result.current.columns.map(column => column.key)).toEqual(['a', 'b']);
    expect(result.current.sorting).toEqual([]);

    act(() => result.current.setSorting([{ id: 'a', desc: true }]));
    act(() => result.current.setSorting(current => [...current, { id: 'b', desc: false }]));

    expect(result.current.sorting).toEqual([
      { id: 'a', desc: true },
      { id: 'b', desc: false },
    ]);
  });

  it('reads saved totals and saves a change, dropping a cleared one', async () => {
    data.table = {
      id: 't1',
      columns: COLUMNS,
      viewSettings: { columns: { a: { aggregate: 'sum' }, b: {} } },
    };
    const { result } = render();
    await waitFor(() => expect(result.current.aggregates).toEqual({ a: 'sum' }));

    act(() => result.current.setAggregate('b', 'avg'));
    expect(result.current.aggregates).toEqual({ a: 'sum', b: 'avg' });
    act(() => result.current.setAggregate('a', null));
    expect(result.current.aggregates).toEqual({ b: 'avg' });

    expect(patch).toHaveBeenLastCalledWith('/custom-tables/t1/view-settings/columns', {
      columnKey: 'a',
      aggregate: null,
    });
  });

  it('exports what is on screen: filters, sort and visible columns', async () => {
    const { result } = render();
    act(() => result.current.setSorting([{ id: 'a', desc: true }]));
    act(() => result.current.setColumnVisibility({ b: false }));

    await act(async () => result.current.exportView('csv'));

    expect(download).toHaveBeenCalledWith('t1', 'csv', {
      filters: 'filters-param',
      sort: JSON.stringify({ col: 'a', dir: 'desc' }),
      columnKeys: ['a'],
    });
    expect(result.current.exporting).toBe(false);
  });

  it('reports a failed export', async () => {
    download.mockRejectedValue(new Error('no'));
    const { result } = render();
    await act(async () => result.current.exportView('xlsx'));
    expect(toastFn.error).toHaveBeenCalledWith('no');
    expect(result.current.exporting).toBe(false);
  });

  it('keeps the conversion result, or says it failed', async () => {
    const payload = { statementId: 's1' };
    post.mockResolvedValueOnce({ data: payload });
    const { result } = render();

    await act(async () => result.current.runConvert());
    expect(post).toHaveBeenCalledWith('/custom-tables/t1/convert-to-statement');
    expect(result.current.convert).toEqual({ open: true, busy: false, result: payload });

    post.mockRejectedValueOnce(new Error('no'));
    await act(async () => result.current.runConvert());
    expect(toastFn.error).toHaveBeenCalledWith('no');
    expect(result.current.convert.busy).toBe(false);
  });

  it('refreshes from the source and reloads the table and rows', async () => {
    post.mockResolvedValueOnce({ data: { inserted: 3, updated: 1 } });
    const { result } = render();
    const before = lastRefreshToken();

    await act(async () => result.current.runRefreshSource());

    expect(post).toHaveBeenCalledWith('/custom-tables/t1/refresh-from-source');
    expect(toastFn.success).toHaveBeenCalledWith('refreshed 3/1');
    expect(data.loadTable).toHaveBeenCalled();
    expect(grid.loadRows).toHaveBeenCalledWith({ reset: true });
    expect(lastRefreshToken()).toBe((before ?? 0) + 1);
    expect(result.current.refreshing).toBe(false);
  });

  it('restoring undoes the view choices kept on this page and reports what it could not', async () => {
    post.mockResolvedValueOnce({ data: { reverted: 4, skippedChanged: 2, failed: ['x'] } });
    const { result } = render();
    act(() => {
      result.current.setRestoreOpen(true);
      result.current.setGroupBy('a');
      result.current.setSorting([{ id: 'a', desc: true }]);
      result.current.setColumnVisibility({ b: false });
      result.current.setRowSelection({ r1: true });
      result.current.setAggregate('a', 'sum');
    });

    await act(async () => result.current.runRestoreDefault());

    expect(post).toHaveBeenCalledWith('/custom-tables/t1/restore-default');
    expect(toastFn.success).toHaveBeenCalledWith('restored 4');
    expect(toastFn).toHaveBeenCalledWith('skipped 2');
    expect(toastFn.error).toHaveBeenCalledWith('not restored 1');
    expect(invalidateLists).toHaveBeenCalled();
    expect(result.current.aggregates).toEqual({});
    expect(result.current.groupBy).toBeNull();
    expect(result.current.sorting).toEqual([]);
    expect(result.current.columnVisibility).toEqual({});
    expect(result.current.rowSelection).toEqual({});
    expect(filters.clearFilters).toHaveBeenCalled();
    expect(filters.setSearchQuery).toHaveBeenCalledWith('');
    expect(data.loadTable).toHaveBeenCalled();
    expect(grid.loadRows).toHaveBeenCalledWith({ reset: true });
    expect(result.current.restoreOpen).toBe(false);
    expect(result.current.restoring).toBe(false);
  });

  it('a failed restore keeps the view and closes the dialog', async () => {
    post.mockRejectedValueOnce(new Error('no'));
    const { result } = render();
    act(() => {
      result.current.setRestoreOpen(true);
      result.current.setGroupBy('a');
    });

    await act(async () => result.current.runRestoreDefault());

    expect(toastFn.error).toHaveBeenCalledWith('no');
    expect(result.current.groupBy).toBe('a');
    expect(result.current.restoreOpen).toBe(false);
    expect(result.current.restoring).toBe(false);
  });

  it('deletes selected rows, sending only the saved ones to the server', async () => {
    const draft = `${DRAFT_ROW_ID_PREFIX}1`;
    const { result } = render();
    act(() => {
      result.current.setRowSelection({ r1: true, [draft]: true });
      result.current.setPendingDelete({ kind: 'rows' });
    });
    expect(result.current.selectedIds).toEqual(['r1', draft]);

    await act(async () => result.current.confirmDelete());

    expect(remove.mock.calls).toEqual([['/custom-tables/t1/rows/r1']]);
    const update = grid.setRows.mock.lastCall?.[0] as (rows: Array<{ id: string }>) => unknown;
    expect(update([{ id: 'r1' }, { id: draft }, { id: 'r2' }])).toEqual([{ id: 'r2' }]);
    expect(toastFn.success).toHaveBeenCalledWith('deleted 2');
    expect(result.current.rowSelection).toEqual({});
    expect(result.current.pendingDelete).toBeNull();
  });

  it('keeps the selection when the delete fails', async () => {
    remove.mockRejectedValue(new Error('no'));
    const { result } = render();
    act(() => {
      result.current.setRowSelection({ r1: true });
      result.current.setPendingDelete({ kind: 'rows' });
    });

    await act(async () => result.current.confirmDelete());

    expect(toastFn.error).toHaveBeenCalledWith('no');
    expect(result.current.rowSelection).toEqual({ r1: true });
    expect(result.current.pendingDelete).toBeNull();
  });

  it('deletes a pending column through the column editor', async () => {
    const column = COLUMNS[0];
    const { result } = render();
    act(() => result.current.setPendingDelete({ kind: 'column', column: column as never }));

    await act(async () => result.current.confirmDelete());

    expect(columnEditor.deleteColumn).toHaveBeenCalledWith(column);
    expect(remove).not.toHaveBeenCalled();
    expect(result.current.pendingDelete).toBeNull();
  });

  it('renames the table on the server and on screen', async () => {
    const { result } = render();

    await act(async () => result.current.rename('New name'));

    expect(patch).toHaveBeenCalledWith('/custom-tables/t1', { name: 'New name' });
    const update = data.setTable.mock.lastCall?.[0] as (t: { name: string }) => unknown;
    expect(update({ name: 'Old' })).toEqual({ name: 'New name' });
    expect(toastFn.success).toHaveBeenCalledWith('renamed');
  });

  it('loads relation targets when the column dialog opens, without this table', async () => {
    decoded.mockResolvedValue({
      items: [
        { id: 't1', name: 'This one' },
        { id: 't2', name: 'Another' },
      ],
    });
    const { result, rerender } = render();
    expect(decoded).not.toHaveBeenCalled();

    columnEditor.dialog = { mode: 'create' };
    rerender();

    await waitFor(() => expect(result.current.relationTargets).toEqual([{ id: 't2', name: 'Another' }]));
    rerender();
    expect(decoded).toHaveBeenCalledTimes(1);
  });

  it('turns a picked group into a filter', () => {
    const { result } = render();
    act(() => result.current.pickGroup('x'));
    expect(filters.addFilter).not.toHaveBeenCalled();

    act(() => result.current.setGroupBy('a'));
    act(() => result.current.pickGroup('x'));
    expect(filters.addFilter).toHaveBeenLastCalledWith({ col: 'a', op: 'eq', value: 'x' });
    act(() => result.current.pickGroup(null));
    expect(filters.addFilter).toHaveBeenLastCalledWith({ col: 'a', op: 'isEmpty' });
  });
});
