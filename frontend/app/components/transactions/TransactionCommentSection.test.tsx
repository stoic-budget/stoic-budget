// @vitest-environment jsdom
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const put = vi.fn();

vi.mock('@/app/lib/api', () => ({
  default: { put: (...args: unknown[]) => put(...args) },
}));

import { apiResponse } from '@/app/test/api-response';
import { renderWithQuery } from '@/app/test/query-wrapper';
import { TransactionCommentSection } from './TransactionCommentSection';

describe('TransactionCommentSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    put.mockResolvedValue(apiResponse(null));
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
});
