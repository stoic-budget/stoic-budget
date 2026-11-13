import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CategoryOption, Transaction } from '../editHelpers';
import { bulkDeleteAction, saveCategoriesAction } from './statement-edit-sync';

const mocks = vi.hoisted(() => ({
  put: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  invalidateQueries: vi.fn(),
  readStatement: vi.fn(),
  readStatementRows: vi.fn(),
}));

vi.mock('@/app/lib/api', () => ({ default: { put: mocks.put, post: mocks.post, patch: mocks.patch } }));
vi.mock('./statement-edit-async', () => ({
  readStatement: mocks.readStatement,
  readStatementRows: mocks.readStatementRows,
}));
vi.mock('@/app/lib/query-client', () => ({
  getQueryClient: () => ({ invalidateQueries: mocks.invalidateQueries }),
}));

const child: CategoryOption = { id: 'cat-2', name: 'Groceries', isEnabled: true };
const categories: CategoryOption[] = [{ id: 'cat-1', name: 'Food', children: [child] }];

const row: Transaction = {
  id: 'tx-1',
  transactionDate: '2026-09-25',
  counterpartyName: 'ACME Store',
  paymentPurpose: 'Receipt',
  debit: 100,
  transactionType: 'expense',
};
const twin: Transaction = { ...row, id: 'tx-2' };

function ctx() {
  let rows: Transaction[] = [row, twin];
  return {
    categories,
    setTransactions: vi.fn((fn: (prev: Transaction[]) => Transaction[]) => {
      rows = fn(rows);
    }),
    setError: vi.fn(),
    messages: { saveTransactionError: 'Could not save' },
    rows: () => rows,
  };
}

describe('saveCategoriesAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.put.mockResolvedValue({ data: {} });
    mocks.post.mockResolvedValue({ data: {} });
  });

  it('sends only the category and shows the picked one, found deep in the tree', async () => {
    const c = ctx();

    await saveCategoriesAction({ [row.id]: child.id }, c);

    expect(mocks.patch).not.toHaveBeenCalled();
    expect(mocks.put).toHaveBeenCalledWith(`/transactions/${row.id}`, { categoryId: child.id });
    expect(c.rows()[0]?.categoryId).toBe(child.id);
    expect(c.rows()[0]?.category?.name).toBe(child.name);
    expect(c.rows()[1]?.categoryId).toBeUndefined();
    expect(c.setError).not.toHaveBeenCalled();
  });

  it('files several rows in one bulk request, each to its own category', async () => {
    const c = ctx();

    const saved = await saveCategoriesAction({ [row.id]: child.id, [twin.id]: '' }, c);

    expect(saved).toBe(true);
    expect(mocks.put).not.toHaveBeenCalled();
    expect(mocks.post).toHaveBeenCalledWith('/transactions/bulk-update', {
      items: [
        { id: row.id, updates: { categoryId: child.id } },
        { id: twin.id, updates: { categoryId: null } },
      ],
    });
    expect(c.rows().map(r => r.categoryId)).toEqual([child.id, undefined]);
  });

  it('clears the category with null', async () => {
    const c = ctx();

    await saveCategoriesAction({ [row.id]: '' }, c);

    expect(mocks.put).toHaveBeenCalledWith(`/transactions/${row.id}`, { categoryId: null });
    expect(c.rows()[0]?.category).toBeUndefined();
  });

  it('refreshes the dashboard and transaction lists after a save', async () => {
    await saveCategoriesAction({ [row.id]: child.id }, ctx());

    expect(mocks.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['dashboard'] });
    expect(mocks.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['transactions'] });
  });

  it('keeps the row and reports the error when the save fails', async () => {
    mocks.put.mockRejectedValue(new Error('offline'));
    const c = ctx();

    await saveCategoriesAction({ [row.id]: child.id }, c);

    expect(c.setTransactions).not.toHaveBeenCalled();
    expect(c.setError).toHaveBeenCalled();
  });
});

describe('bulkDeleteAction', () => {
  const third: Transaction = { ...row, id: 'tx-3' };

  function deleteCtx(selected: string[]) {
    let rows: Transaction[] = [row, twin, third];
    return {
      statementId: 'st-1',
      setStatement: vi.fn(),
      selectedRows: new Set(selected),
      setTransactions: vi.fn((fn: (prev: Transaction[]) => Transaction[]) => {
        rows = fn(rows);
      }),
      setSaving: vi.fn(),
      setSelectedRows: vi.fn(),
      setSuccess: vi.fn(),
      setError: vi.fn(),
      messages: { deleteTransactionsError: 'Could not delete', loadDataError: 'Could not load' },
      rows: () => rows,
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    mocks.post.mockResolvedValue({ data: { deleted: 2 } });
    mocks.readStatement.mockResolvedValue({ id: 'st-1', totalTransactions: 1 });
    // The server's rows after the delete: the one left, as it now stands.
    mocks.readStatementRows.mockResolvedValue([{ ...twin, comments: 'unflagged by the delete' }]);
  });

  it('sends the selected ids, drops those rows and clears the selection', async () => {
    const c = deleteCtx([row.id, third.id]);

    await bulkDeleteAction('Delete 2?', vi.fn(), c);

    // The header's row count is read back from the server.
    expect(mocks.readStatement).toHaveBeenCalledWith('st-1');
    expect(c.setStatement).toHaveBeenCalledWith({ id: 'st-1', totalTransactions: 1 });
    expect(mocks.post).toHaveBeenCalledWith('/transactions/bulk-delete', {
      ids: [row.id, third.id],
    });
    // The rows are the server's after the delete, not the local copy.
    expect(c.rows()).toEqual([{ ...twin, comments: 'unflagged by the delete' }]);
    expect(c.setSelectedRows).toHaveBeenCalledWith(new Set());
    expect(mocks.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['transactions'] });
    expect(c.setError).not.toHaveBeenCalled();
  });

  it('keeps every row and the selection when the delete is refused', async () => {
    mocks.post.mockRejectedValue(new Error('not found'));
    const c = deleteCtx([row.id]);

    await bulkDeleteAction('Delete 1?', vi.fn(), c);

    expect(c.setStatement).not.toHaveBeenCalled();
    expect(c.setTransactions).not.toHaveBeenCalled();
    expect(c.setSelectedRows).not.toHaveBeenCalled();
    expect(c.setError).toHaveBeenCalled();
    expect(c.setSaving).toHaveBeenLastCalledWith(false);
  });

  it('still drops the rows and the selection when the statement cannot be read back', async () => {
    mocks.readStatement.mockRejectedValue(new Error('offline'));
    const c = deleteCtx([row.id]);

    await bulkDeleteAction('Delete 1?', vi.fn(), c);

    expect(c.rows().map(t => t.id)).toEqual([twin.id, third.id]);
    expect(c.setSelectedRows).toHaveBeenCalledWith(new Set());
    expect(c.setError).toHaveBeenCalledTimes(1);
    expect(c.setSaving).toHaveBeenLastCalledWith(false);
  });

  it('sends nothing when the person cancels', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);

    await bulkDeleteAction('Delete 1?', vi.fn(), deleteCtx([row.id]));

    expect(mocks.post).not.toHaveBeenCalled();
  });
});
