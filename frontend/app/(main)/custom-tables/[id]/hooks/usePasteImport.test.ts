import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CustomTablePageColumn } from '../utils/tableTypes';
import type { CustomTableGridRow } from '../utils/types';

const post = vi.fn();
const patch = vi.fn();
const remove = vi.fn();
const toastError = vi.fn();

vi.mock('@/app/lib/api', () => ({
  default: {
    post: (...args: unknown[]) => post(...args),
    patch: (...args: unknown[]) => patch(...args),
    delete: (...args: unknown[]) => remove(...args),
  },
}));
vi.mock('@/app/lib/query-fn-schema', () => ({
  checkContract: async (_name: string, data: unknown) => data,
  apiQueryDecoded: async () => ({ items: [] }),
}));
vi.mock('react-hot-toast', () => ({ default: { error: (...a: unknown[]) => toastError(...a) } }));

import { usePasteImport } from './usePasteImport';

const VENDOR = { key: 'vendor', title: 'Vendor', type: 'text', position: 0 };
const CLIPBOARD = 'Vendor\tUnits\nACME Store\t10\nExample Shop\t20';

const messages = {
  noRows: 'no rows',
  missingColumnTitle: 'missing title',
  insertFailed: 'insert failed',
  undoFailed: 'undo failed',
  fileReadFailed: 'read failed',
  fileUnsupported: 'unsupported',
  fileTooLarge: 'too large',
  fileEmpty: 'empty',
};
const pasteDefaults = {
  date: 'Date',
  type: 'Type',
  amount: 'Amount',
  currency: 'Currency',
  comment: 'Comment',
  paid: 'Paid',
  columnPrefix: 'Column',
};

function setup() {
  let rows: CustomTableGridRow[] = [];
  const setRows = vi.fn((update: React.SetStateAction<CustomTableGridRow[]>) => {
    rows = typeof update === 'function' ? update(rows) : update;
  });
  const loadTable = vi.fn(async () => {});
  const onRowsChanged = vi.fn();
  const onInsertSuccess = vi.fn();
  const orderedColumns = [VENDOR] as unknown as CustomTablePageColumn[];
  const hook = renderHook(() =>
    usePasteImport({
      tableId: 't1',
      orderedColumns,
      pasteDefaults,
      loadTable,
      onRowsChanged,
      setRows,
      onInsertSuccess,
      messages,
    }),
  );
  return { ...hook, setRows, loadTable, onRowsChanged, onInsertSuccess, rowsNow: () => rows };
}

const pasteEvent = (text: string) => {
  const event = new Event('paste', { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'clipboardData', { value: { getData: () => text } });
  return event;
};

async function openPreview(result: { current: ReturnType<typeof usePasteImport> }, text = CLIPBOARD) {
  act(() => result.current.startPastePreview(text));
  await waitFor(() => expect(result.current.pastePreview).not.toBeNull());
}

const batchAnswer = (from: number, count: number) => ({
  data: {
    rows: Array.from({ length: count }, (_, index) => ({
      id: `row-${from + index}`,
      rowNumber: from + index,
      data: {},
    })),
  },
});

describe('usePasteImport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    post.mockReset();
    remove.mockReset().mockResolvedValue({ data: {} });
    patch.mockReset().mockResolvedValue({ data: {} });
    post.mockImplementation(async (url: string) =>
      url.endsWith('/columns')
        ? { data: { id: 'col-new', key: 'units_key' } }
        : batchAnswer(1, 2),
    );
  });

  it('opens the preview for tabular text pasted outside a field, and ignores the rest', async () => {
    const { result } = setup();

    act(() => {
      document.body.dispatchEvent(pasteEvent('a single line'));
    });
    expect(result.current.pastePreviewOpen).toBe(false);

    const input = document.createElement('input');
    document.body.append(input);
    act(() => {
      input.dispatchEvent(pasteEvent(CLIPBOARD));
    });
    expect(result.current.pastePreviewOpen).toBe(false);
    input.remove();

    const event = pasteEvent(CLIPBOARD);
    act(() => {
      document.body.dispatchEvent(event);
    });
    expect(event.defaultPrevented).toBe(true);
    expect(result.current.pastePreviewOpen).toBe(true);
    await waitFor(() => expect(result.current.pastePreview?.dataRows).toHaveLength(2));
    expect(result.current.pasteUseHeaders).toBe(true);
  });

  it('creates the new column, sends rows under its real key, then offers undo', async () => {
    const view = setup();
    await openPreview(view.result);

    await act(async () => view.result.current.handlePasteAdd());

    expect(post).toHaveBeenCalledWith(
      '/custom-tables/t1/columns',
      expect.objectContaining({ title: 'Units', type: 'number' }),
    );
    const batch = post.mock.calls.find(([url]) => url.endsWith('/rows/batch'));
    expect(batch?.[1].rows[0].data).toMatchObject({ vendor: 'ACME Store', units_key: 10 });
    expect(view.rowsNow().map(row => row.id)).toEqual(['row-1', 'row-2']);
    expect(view.onRowsChanged).toHaveBeenCalledTimes(1);
    expect(view.onInsertSuccess).toHaveBeenCalledWith(
      { createdCount: 2, issueCount: 0 },
      expect.any(Function),
    );
    expect(view.result.current.pastePreviewOpen).toBe(false);
    expect(view.result.current.pastePreview).toBeNull();
    expect(view.result.current.pasteApplying).toBe(false);
    expect(view.result.current.pasteProgress).toBeNull();
  });

  it('undo removes the inserted rows and the columns the import created', async () => {
    const view = setup();
    await openPreview(view.result);
    await act(async () => view.result.current.handlePasteAdd());
    const undo = view.onInsertSuccess.mock.calls[0][1] as () => Promise<void>;
    view.loadTable.mockClear();
    view.onRowsChanged.mockClear();

    await act(async () => undo());

    expect(remove.mock.calls.map(([url]) => url)).toEqual([
      '/custom-tables/t1/rows/row-1',
      '/custom-tables/t1/rows/row-2',
      '/custom-tables/t1/columns/col-new',
    ]);
    expect(view.rowsNow()).toEqual([]);
    expect(view.loadTable).toHaveBeenCalledTimes(1);
    expect(view.onRowsChanged).toHaveBeenCalledTimes(1);
  });

  it('says undo failed instead of throwing', async () => {
    const view = setup();
    await openPreview(view.result);
    await act(async () => view.result.current.handlePasteAdd());
    remove.mockRejectedValue(new Error('offline'));

    await act(async () => view.onInsertSuccess.mock.calls[0][1]());

    expect(toastError).toHaveBeenCalledWith('undo failed');
  });

  it('sends 500 rows a request and keeps what got in when a later batch fails', async () => {
    const lines = Array.from({ length: 501 }, (_, index) => `Vendor ${index}\t${index + 1}`);
    const view = setup();
    await openPreview(view.result, `Vendor\tUnits\n${lines.join('\n')}`);
    let batches = 0;
    post.mockImplementation(async (url: string) => {
      if (url.endsWith('/columns')) {
        return { data: { id: 'col-new', key: 'units_key' } };
      }
      batches += 1;
      if (batches === 2) {
        throw new Error('the server said no');
      }
      return batchAnswer(1, 500);
    });

    await act(async () => view.result.current.handlePasteAdd());

    expect(batches).toBe(2);
    expect(toastError).toHaveBeenCalledWith('the server said no');
    expect(view.rowsNow()).toHaveLength(500);
    expect(view.onRowsChanged).toHaveBeenCalledTimes(1);
    expect(view.onInsertSuccess).not.toHaveBeenCalled();
    // The dialog stays open on what is left to fix.
    expect(view.result.current.pastePreviewOpen).toBe(true);
    expect(view.result.current.pasteApplying).toBe(false);
    expect(view.result.current.pasteProgress).toBeNull();
  });

  it('refuses a new column without a title', async () => {
    const view = setup();
    await openPreview(view.result);
    const source = view.result.current.pastePreview?.columns.find(c => c.mode === 'new');
    act(() =>
      view.result.current.handlePasteMappingChange(source?.sourceIndex as number, {
        mode: 'new',
        newTitle: '  ',
      }),
    );
    await waitFor(() => expect(view.result.current.hasMissingPasteColumnTitles).toBe(true));

    await act(async () => view.result.current.handlePasteAdd());

    expect(toastError).toHaveBeenCalledWith('missing title');
    expect(post).not.toHaveBeenCalled();
  });

  it('merges new rows with those on screen by id, in row order', async () => {
    const view = setup();
    act(() => {
      view.setRows([{ id: 'row-2', rowNumber: 2, data: {} } as unknown as CustomTableGridRow]);
    });
    await openPreview(view.result);
    post.mockImplementation(async (url: string) =>
      url.endsWith('/columns')
        ? { data: { id: 'col-new', key: 'units_key' } }
        : {
            data: {
              rows: [
                { id: 'row-1', rowNumber: 1, data: {} },
                { id: 'row-2', rowNumber: 2, data: {} },
              ],
            },
          },
    );

    await act(async () => view.result.current.handlePasteAdd());

    expect(view.rowsNow().map(row => row.id)).toEqual(['row-1', 'row-2']);
  });

  it('resetting forgets the preview and the choices made in it', async () => {
    const view = setup();
    await openPreview(view.result);
    act(() => view.result.current.setPasteApplyTotals(false));
    act(() => view.result.current.handlePasteCellChange(0, 0, 'Edited'));

    act(() => view.result.current.resetPastePreview());

    expect(view.result.current.pastePreviewOpen).toBe(false);
    expect(view.result.current.pastePreview).toBeNull();
    expect(view.result.current.pasteRawRows).toEqual([]);
    expect(view.result.current.pasteEdits).toEqual({});
    expect(view.result.current.pasteMapping).toEqual({});
    expect(view.result.current.pasteUseHeaders).toBe(false);
    expect(view.result.current.pasteApplyTotals).toBe(true);
  });
});
