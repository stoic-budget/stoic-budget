// @vitest-environment jsdom
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const put = vi.fn();
const get = vi.fn();

vi.mock('@/app/lib/api', () => ({
  default: {
    put: (...args: unknown[]) => put(...args),
    get: (...args: unknown[]) => get(...args),
  },
}));
vi.mock('@/app/hooks/useWorkspaceId', () => ({ useWorkspaceId: () => 'ws-1' }));

import { apiResponse } from '@/app/test/api-response';
import { renderWithQuery } from '@/app/test/query-wrapper';
import { TransactionCommentSection } from './TransactionCommentSection';

describe('TransactionCommentSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    put.mockResolvedValue(apiResponse(null));
    get.mockResolvedValue(apiResponse({ edit: null }));
  });

  it("shows the row's comment and saves a new one when the field is left", async () => {
    renderWithQuery(<TransactionCommentSection transactionId="tx-1" comment="Team coffee" />);
    const field = screen.getByLabelText('Comment') as HTMLInputElement;
    expect(field.value).toBe('Team coffee');

    fireEvent.change(field, { target: { value: ' Coffee for the team ' } });
    fireEvent.blur(field);

    await waitFor(() =>
      expect(put).toHaveBeenCalledWith('/transactions/tx-1', { comments: 'Coffee for the team' }),
    );
  });

  it('clears the comment with an empty field, and writes nothing when it did not change', async () => {
    renderWithQuery(<TransactionCommentSection transactionId="tx-1" comment="Team coffee" />);
    const field = screen.getByLabelText('Comment');

    fireEvent.blur(field);
    expect(put).not.toHaveBeenCalled();

    fireEvent.change(field, { target: { value: '' } });
    fireEvent.blur(field);
    await waitFor(() => expect(put).toHaveBeenCalledWith('/transactions/tx-1', { comments: null }));
  });

  it('offers to add one to a row without a comment', () => {
    renderWithQuery(<TransactionCommentSection transactionId="tx-1" comment={null} />);

    expect((screen.getByPlaceholderText('Add a comment') as HTMLInputElement).value).toBe('');
  });

  describe('who edited it last', () => {
    const at = '2026-05-12T09:30:00.000Z';
    const answer = (edit: { by: 'you' | 'member'; name: string | null } | null) =>
      get.mockResolvedValue(apiResponse({ edit: edit && { at, ...edit } }));
    const line = () => screen.findByText(/^Edited/);

    it('says it was you, with the day, and the full time on hover', async () => {
      answer({ by: 'you', name: null });
      renderWithQuery(<TransactionCommentSection transactionId="tx-1" comment="Team coffee" />);

      const edited = await line();
      expect(edited.textContent).toMatch(/^Edited by you · .*12/);
      expect(edited.getAttribute('title')).toMatch(/2026/);
      expect(get).toHaveBeenCalledWith('/transactions/tx-1/comment-edit', expect.anything());
    });

    it('names the member who edited it', async () => {
      answer({ by: 'member', name: 'Member Two' });
      renderWithQuery(<TransactionCommentSection transactionId="tx-1" comment="Lunch" />);

      expect((await line()).textContent).toMatch(/^Edited · Member Two · .*12/);
    });

    it('says only "Edited" for someone no longer in the workspace', async () => {
      answer({ by: 'member', name: null });
      renderWithQuery(<TransactionCommentSection transactionId="tx-1" comment="Lunch" />);

      const text = (await line()).textContent ?? '';
      expect(text).toMatch(/^Edited · [^·]*12[^·]*$/);
      expect(text).not.toContain('null');
    });

    it('shows nothing when nobody edited the comment', async () => {
      answer(null);
      renderWithQuery(<TransactionCommentSection transactionId="tx-1" comment="Imported note" />);

      await waitFor(() => expect(get).toHaveBeenCalled());
      expect(screen.queryByText(/^Edited/)).toBeNull();
    });
  });
});
