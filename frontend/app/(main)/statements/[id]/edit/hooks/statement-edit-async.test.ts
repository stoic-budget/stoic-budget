import { beforeEach, describe, expect, it, vi } from 'vitest';
import { metadataAutoSave } from './statement-edit-async';

const mocks = vi.hoisted(() => ({ patch: vi.fn(), toastError: vi.fn() }));
vi.mock('@/app/lib/api', () => ({ default: { patch: mocks.patch, get: vi.fn() } }));
vi.mock('react-hot-toast', () => ({ toast: { error: mocks.toastError } }));
vi.mock('@/app/lib/invalidate-document-lists', () => ({ invalidateDocumentLists: vi.fn() }));

const formData = {
  balanceStart: '100.00',
  balanceEnd: '2340.10',
  statementDateFrom: '2026-10-01',
  statementDateTo: '2026-10-31',
};

describe('metadataAutoSave', () => {
  beforeEach(() => vi.clearAllMocks());

  it('tells the person and rethrows when the server refuses, so the value stays unsaved', async () => {
    // A refusal with no message of its own gets the editor's text.
    const refusal = {};
    mocks.patch.mockRejectedValueOnce(refusal);

    await expect(
      metadataAutoSave({
        statementId: 'statement-1',
        formData: formData as never,
        setStatement: vi.fn(),
        failedMessage: 'Failed to update statement data',
      }),
    ).rejects.toBe(refusal);

    expect(mocks.toastError).toHaveBeenCalledWith('Failed to update statement data');
  });
});
