// @vitest-environment jsdom
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TransactionAttachment } from '@/app/lib/contracts';
import { WorkspaceDataContext } from '@/app/contexts/WorkspaceContext';
import { apiResponse } from '@/app/test/api-response';
import { renderWithQuery } from '@/app/test/query-wrapper';
import { TransactionFilesSection } from './TransactionFilesSection';

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), delete: vi.fn() }));
const toasts = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));

vi.mock('@/app/lib/api', () => ({ default: api, apiBaseUrl: '/api/v1' }));
vi.mock('@/app/hooks/useWorkspaceId', () => ({ useWorkspaceId: () => 'ws-1' }));
vi.mock('react-hot-toast', () => ({ default: toasts }));
vi.mock('@/app/i18n', async () => {
  const { autoDictionary, value } = await import(
    '@/app/components/dashboard/__tests__/intlayer-mock'
  );
  return {
    useLocale: () => ({ locale: 'en' }),
    useIntlayer: () =>
      autoDictionary({
        title: value('Files'),
        add: value('Add a file'),
        remove: value('Remove'),
        removeQuestion: value('Remove this file?'),
        cancel: value('Cancel'),
        removed: value('File removed'),
        tooBig: value('This file is over 10 MB'),
        wrongType: value('Only photos and PDF files can be attached'),
        addFailed: value('Could not add the file'),
        removeFailed: value('Could not remove the file'),
        loadFailed: value('Could not load the files'),
      }),
  };
});

const TX = 'tx-1';
const invoiceName = 'ACME Store - Invoice 7.pdf';
const invoice: TransactionAttachment = {
  id: 'att-1',
  transactionId: TX,
  fileName: invoiceName,
  mimeType: 'application/pdf',
  fileSize: String(120 * 1024),
  createdAt: '2026-10-14T09:30:00.000Z',
};
const listUrl = `/transactions/${TX}/attachments`;
/** The member's role and rights in the open workspace; each test sets its own. */
const workspace: { current: Record<string, unknown> } = { current: {} };
const renderSection = () =>
  renderWithQuery(
    <WorkspaceDataContext.Provider
      value={{ currentWorkspace: workspace.current as never, workspaces: [], loading: false, error: null }}
    >
      <TransactionFilesSection transactionId={TX} />
    </WorkspaceDataContext.Provider>,
  );

const httpError = (status: number, code?: string) =>
  Object.assign(new Error(`HTTP ${status}`), {
    isAxiosError: true,
    response: { status, data: { error: { code, message: `HTTP ${status}` } } },
  });

const pick = (file: File) =>
  fireEvent.change(screen.getByTestId('tx-files-input'), { target: { files: [file] } });

describe('TransactionFilesSection', () => {
  let stored: TransactionAttachment[];

  beforeEach(() => {
    stored = [];
    workspace.current = { memberRole: 'owner', memberPermissions: null };
    api.get.mockReset().mockImplementation(async () => apiResponse([...stored]));
    api.post.mockReset();
    api.delete.mockReset();
    toasts.success.mockReset();
    toasts.error.mockReset();
  });

  it('shows only the drop box while the row has no files', async () => {
    renderSection();

    await waitFor(() => expect(api.get).toHaveBeenCalledWith(listUrl, expect.anything()));
    expect(screen.getByText('Files')).toBeTruthy();
    expect(screen.getByTestId('tx-files-drop')).toBeTruthy();
    expect(screen.queryByRole('listitem')).toBeNull();
    expect(screen.getByTestId('tx-files-input').getAttribute('accept')).toBe(
      'image/*,application/pdf',
    );
  });

  it('lists a file with its name, size and date', async () => {
    stored = [invoice];
    renderSection();

    expect(await screen.findByText(invoiceName)).toBeTruthy();
    expect(screen.getByText(/120 kB · Oct 14, 2026/)).toBeTruthy();
  });

  it('sends a picked file and shows it once the list refreshes', async () => {
    const photo = new File([new Uint8Array(2048)], 'ACME Store - Wireless Buds.png', {
      type: 'image/png',
    });
    api.post.mockImplementation(async (_url: string, body: FormData) => {
      expect(body.get('file')).toBe(photo);
      const saved = { ...invoice, id: 'att-2', fileName: photo.name, mimeType: 'image/png' };
      stored = [saved];
      return apiResponse(saved);
    });
    // The thumbnail asks for the bytes; any blob will do.
    api.get.mockImplementation(async (url: string) =>
      url.endsWith('/download')
        ? apiResponse(new Blob([new Uint8Array(4)], { type: 'image/png' }))
        : apiResponse([...stored]),
    );
    renderSection();
    await waitFor(() => expect(api.get).toHaveBeenCalled());

    pick(photo);

    expect(await screen.findByText(photo.name)).toBeTruthy();
    expect(api.post).toHaveBeenCalledWith(listUrl, expect.any(FormData), {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  });

  it('refuses a wrong type or an oversized file without sending it', async () => {
    renderSection();
    await waitFor(() => expect(api.get).toHaveBeenCalled());

    pick(new File(['<svg/>'], 'logo.svg', { type: 'image/svg+xml' }));
    pick(
      new File([new Uint8Array(10 * 1024 * 1024 + 1)], 'scan.pdf', { type: 'application/pdf' }),
    );

    await waitFor(() => expect(toasts.error).toHaveBeenCalledTimes(2));
    expect(toasts.error).toHaveBeenNthCalledWith(1, 'Only photos and PDF files can be attached');
    expect(toasts.error).toHaveBeenNthCalledWith(2, 'This file is over 10 MB');
    expect(api.post).not.toHaveBeenCalled();
  });

  it('says why the server refused a file', async () => {
    api.post.mockRejectedValue(httpError(403));
    renderSection();
    await waitFor(() => expect(api.get).toHaveBeenCalled());

    pick(new File(['%PDF-1.4'], 'invoice.pdf', { type: 'application/pdf' }));

    await waitFor(() => expect(toasts.error).toHaveBeenCalledWith('HTTP 403'));
  });

  it('removes a file only after the question is answered', async () => {
    stored = [invoice];
    api.delete.mockImplementation(async () => {
      stored = [];
      return apiResponse({ message: 'Attachment deleted' });
    });
    renderSection();
    await screen.findByText(invoiceName);

    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    expect(screen.getByText('Remove this file?')).toBeTruthy();
    expect(api.delete).not.toHaveBeenCalled();
    const [, confirm] = screen.getAllByRole('button', { name: 'Remove' });
    fireEvent.click(confirm);

    await waitFor(() =>
      expect(api.delete).toHaveBeenCalledWith(`/transactions/attachments/${invoice.id}`),
    );
    await waitFor(() => expect(screen.queryByText(invoiceName)).toBeNull());
    expect(toasts.success).toHaveBeenCalledWith('File removed');
  });

  it('keeps the file when the question is cancelled', async () => {
    stored = [invoice];
    renderSection();
    await screen.findByText(invoiceName);

    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByText('Remove this file?')).toBeNull();
    expect(api.delete).not.toHaveBeenCalled();
  });

  it('lets a viewer open files but not add or remove them', async () => {
    workspace.current = { memberRole: 'viewer', memberPermissions: null };
    stored = [invoice];
    renderSection();

    expect(await screen.findByText(invoiceName)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Remove' })).toBeNull();
    expect(screen.queryByTestId('tx-files-drop')).toBeNull();
  });

  it('lets a member add files only when allowed to edit statements', async () => {
    workspace.current = { memberRole: 'member', memberPermissions: { canEditStatements: false } };
    const { unmount } = renderSection();
    await waitFor(() => expect(api.get).toHaveBeenCalled());
    expect(screen.queryByTestId('tx-files-drop')).toBeNull();
    unmount();

    workspace.current = { memberRole: 'member', memberPermissions: { canEditStatements: true } };
    renderSection();
    expect(await screen.findByTestId('tx-files-drop')).toBeTruthy();
  });

  it('says the list could not be loaded', async () => {
    api.get.mockRejectedValue(httpError(500));
    renderSection();

    expect(await screen.findByText('Could not load the files', {}, { timeout: 4000 })).toBeTruthy();
  });

  it("stays out of the way on a row the viewer may not see (another member's private row)", async () => {
    api.get.mockRejectedValue(httpError(404, 'TRANSACTION_NOT_FOUND'));
    const { container } = renderSection();

    await waitFor(() => expect(api.get).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(container.querySelector('.seneca-tx-files')).toBeNull());
    expect(api.get).toHaveBeenCalledTimes(1);
  });
});
