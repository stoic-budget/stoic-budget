// @vitest-environment jsdom
import { waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHookWithQuery } from '@/app/test/query-wrapper';
import { useFollowableAccounts } from './useFollowableAccounts';

const answers = vi.hoisted(() => ({ members: null as null | Promise<unknown> }));

vi.mock('@/app/hooks/useWorkspaceId', () => ({ useWorkspaceId: () => 'ws-1' }));
vi.mock('@/app/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'user-1' } }) }));
vi.mock('@/app/lib/query-fn-schema', () => ({
  apiQueryDecoded: ({ url }: { url: string }) =>
    url === '/wallets'
      ? Promise.resolve([
          { id: 'shared', name: 'ACME Shared', currency: 'EUR', isActive: true, ownerMemberId: null },
          { id: 'mine', name: 'ACME Mine', currency: 'EUR', isActive: true, ownerMemberId: 'm-1' },
          { id: 'theirs', name: 'ACME Theirs', currency: 'EUR', isActive: true, ownerMemberId: 'm-2' },
        ])
      : answers.members,
}));

const ids = (rows: Array<{ id: string }>) => rows.map(row => row.id);
const member = (id: string, memberId: string) => ({ id, memberId, name: id, email: null });

describe('useFollowableAccounts', () => {
  beforeEach(() => {
    answers.members = null;
  });

  it("offers only shared accounts until the member list answers, never another member's own", async () => {
    answers.members = new Promise(() => {});
    const { result } = renderHookWithQuery(() => useFollowableAccounts(true, null));

    await waitFor(() => expect(ids(result.current)).toEqual(['shared']));
  });

  it('still leaves the other members out when the member list fails', async () => {
    answers.members = Promise.reject(new Error('members down'));
    const { result } = renderHookWithQuery(() => useFollowableAccounts(true, null));

    await waitFor(() => expect(ids(result.current)).toEqual(['shared']));
  });

  it("adds the viewer's own account once the household is known", async () => {
    answers.members = Promise.resolve({ members: [member('user-1', 'm-1'), member('user-2', 'm-2')] });
    const { result } = renderHookWithQuery(() => useFollowableAccounts(true, null));

    await waitFor(() => expect(ids(result.current)).toEqual(['shared', 'mine']));
  });

  it('offers every account in a workspace of one', async () => {
    answers.members = Promise.resolve({ members: [member('user-1', 'm-1')] });
    const { result } = renderHookWithQuery(() => useFollowableAccounts(true, null));

    await waitFor(() => expect(ids(result.current)).toEqual(['shared', 'mine', 'theirs']));
  });
});
