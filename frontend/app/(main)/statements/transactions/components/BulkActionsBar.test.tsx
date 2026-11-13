// @vitest-environment jsdom
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import toast from 'react-hot-toast';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TagListItem } from '@/app/lib/contracts';
import { invalidateFinancialData } from '@/app/lib/invalidate-document-lists';
import { apiResponse } from '@/app/test/api-response';
import { renderWithQuery } from '@/app/test/query-wrapper';
import { BulkActionsBar } from './BulkActionsBar';

const api = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn(), patch: vi.fn(), post: vi.fn() }));

vi.mock('@/app/lib/api', () => ({ default: api }));
vi.mock('@/app/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'user-1' } }) }));
vi.mock('@/app/contexts/WorkspaceContext', () => ({
  useWorkspace: () => ({ currentWorkspace: { id: 'w1' } }),
}));
vi.mock('@/app/lib/invalidate-document-lists', () => ({ invalidateFinancialData: vi.fn() }));
vi.mock('react-hot-toast', () => {
  const toastFn = Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() });
  return { default: toastFn };
});

const tag = (id: string, name: string): TagListItem => ({
  id,
  name,
  color: null,
  description: null,
  tagDate: null,
  usageCount: 0,
});
const trip = tag('9c1a7d0e-0000-4000-8000-000000000001', 'Summer Trip');
const work = tag('9c1a7d0e-0000-4000-8000-000000000002', 'Work');
const rowIds = ['row-one', 'row-two'];

function renderBar() {
  const onDone = vi.fn();
  renderWithQuery(
    <BulkActionsBar
      selected={new Set(rowIds)}
      categories={[]}
      onSetCategory={vi.fn()}
      onDone={onDone}
    />,
  );
  return { onDone };
}

describe('BulkActionsBar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.get.mockImplementation((url: string) =>
      url === '/tags'
        ? Promise.resolve(apiResponse([trip, work]))
        : Promise.reject(new Error(`Unexpected GET ${url}`)),
    );
    api.post.mockResolvedValue(apiResponse({ updated: 2, skippedPrivate: 0, skippedTooLong: 0 }));
  });

  it('adds the picked tags to the ticked rows and refreshes the lists', async () => {
    const { onDone } = renderBar();
    fireEvent.click(screen.getByRole('button', { name: /Add tags/ }));
    const drawer = await screen.findByRole('presentation');
    const confirm = within(drawer).getByRole('button', { name: 'Add to selected' });
    // Nothing picked, nothing to add.
    expect(confirm).toBeDisabled();

    fireEvent.click(await within(drawer).findByRole('button', { name: trip.name }));
    fireEvent.click(within(drawer).getByRole('button', { name: work.name }));
    fireEvent.click(confirm);

    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(api.post).toHaveBeenCalledWith('/transactions/bulk-annotate', {
      ids: rowIds,
      addTagIds: [trip.id, work.id],
    });
    expect(invalidateFinancialData).toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith('Tags added');
  });

  it('appends one trimmed comment to the ticked rows', async () => {
    const { onDone } = renderBar();
    fireEvent.click(screen.getByRole('button', { name: 'Add a comment' }));
    const field = await screen.findByRole('textbox', { name: 'Add a comment' });
    fireEvent.change(field, { target: { value: '  Shared with Member One  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add to selected' }));

    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(api.post).toHaveBeenCalledWith('/transactions/bulk-annotate', {
      ids: rowIds,
      note: 'Shared with Member One',
    });
    expect(invalidateFinancialData).toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith('Comment added');
    expect(toast).not.toHaveBeenCalled();
  });

  it('says how many private rows of other members kept their comment', async () => {
    api.post.mockResolvedValue(apiResponse({ updated: 1, skippedPrivate: 1, skippedTooLong: 0 }));
    renderBar();
    fireEvent.click(screen.getByRole('button', { name: 'Add a comment' }));
    fireEvent.change(await screen.findByRole('textbox', { name: 'Add a comment' }), {
      target: { value: 'Checked' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add to selected' }));

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith('Other members’ private rows kept their own comment: 1'),
    );
  });

  it('says how many rows kept their comment because it would grow past 1000 characters', async () => {
    api.post.mockResolvedValue(apiResponse({ updated: 1, skippedPrivate: 0, skippedTooLong: 2 }));
    renderBar();
    fireEvent.click(screen.getByRole('button', { name: 'Add a comment' }));
    fireEvent.change(await screen.findByRole('textbox', { name: 'Add a comment' }), {
      target: { value: 'Checked' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add to selected' }));

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        'Comment would pass 1000 characters, rows left as they were: 2',
      ),
    );
  });

  it('keeps the selection and the typed text when saving fails', async () => {
    api.post.mockRejectedValue(new Error('offline'));
    const { onDone } = renderBar();
    fireEvent.click(screen.getByRole('button', { name: 'Add a comment' }));
    const field = await screen.findByRole('textbox', { name: 'Add a comment' });
    fireEvent.change(field, { target: { value: 'Checked' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add to selected' }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Couldn’t add the comment'));
    expect(onDone).not.toHaveBeenCalled();
    expect(invalidateFinancialData).not.toHaveBeenCalled();
    expect(screen.getByRole('textbox', { name: 'Add a comment' })).toHaveValue('Checked');
  });

  it('reports a failed tag save and keeps the selection', async () => {
    api.post.mockRejectedValue(new Error('offline'));
    const { onDone } = renderBar();
    fireEvent.click(screen.getByRole('button', { name: /Add tags/ }));
    const drawer = await screen.findByRole('presentation');
    fireEvent.click(await within(drawer).findByRole('button', { name: trip.name }));
    fireEvent.click(within(drawer).getByRole('button', { name: 'Add to selected' }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Couldn’t add the tags'));
    expect(onDone).not.toHaveBeenCalled();
  });

  it('offers both actions in the More menu used on a phone', async () => {
    renderBar();
    fireEvent.click(screen.getByRole('button', { name: /More/ }));
    const menu = await screen.findByRole('menu');
    expect(within(menu).getByText('Add tags')).toBeInTheDocument();
    fireEvent.click(within(menu).getByText('Add a comment'));
    expect(await screen.findByRole('textbox', { name: 'Add a comment' })).toBeInTheDocument();
  });
});
