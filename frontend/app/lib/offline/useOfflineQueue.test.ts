import { describe, expect, it, vi } from 'vitest';
import { createMemoryStore, type OfflineEntry, replay, setOfflineQueueUser } from './offline-queue';
import { sendOfflineEntry } from './useOfflineQueue';

const post = vi.hoisted(() => vi.fn());
vi.mock('@/app/lib/api', () => ({ default: { post } }));

const entry: OfflineEntry = {
  id: 'e1',
  kind: 'manual-expense',
  createdAt: '2026-10-01T08:00:00.000Z',
  fields: { amount: '12' },
  files: [],
  attempts: 0,
};

const refusal = (code: string, status = 403) => ({
  isAxiosError: true,
  response: { status, data: { error: { code, message: 'refused' } } },
});

describe('sendOfflineEntry inside a past version', () => {
  it('keeps an entry a past version refused, for the live workspace', async () => {
    post.mockRejectedValue(refusal('VERSION_READ_ONLY'));
    const store = createMemoryStore([entry]);

    await replay(store, sendOfflineEntry);

    expect((await store.list()).map(e => e.id)).toEqual(['e1']);
  });

  it('still drops an entry the server rejected for good', async () => {
    post.mockRejectedValue(refusal('FORBIDDEN'));
    const store = createMemoryStore([entry]);

    await replay(store, sendOfflineEntry);

    expect(await store.list()).toEqual([]);
  });

  it('keeps entries when the session has ended, for their owner to sign in again (#784)', async () => {
    post.mockRejectedValue(refusal('UNAUTHORIZED', 401));
    const store = createMemoryStore([entry]);

    await replay(store, sendOfflineEntry);

    expect((await store.list()).map(e => e.id)).toEqual(['e1']);
  });

  it("leaves another person's entries waiting, unsent (#784)", async () => {
    post.mockClear();
    post.mockResolvedValue({ data: {} });
    setOfflineQueueUser('member-two');
    const store = createMemoryStore([{ ...entry, userId: 'member-one' }]);

    expect(await replay(store, sendOfflineEntry)).toEqual({ sent: 0, kept: 1 });
    expect(post).not.toHaveBeenCalled();
    expect((await store.list()).map(e => e.id)).toEqual(['e1']);
    setOfflineQueueUser(null);
  });

  it('sends an entry into the workspace it was made in (#784)', async () => {
    post.mockResolvedValue({ data: {} });
    const store = createMemoryStore([{ ...entry, workspaceId: 'ws-taken-in' }]);

    await replay(store, sendOfflineEntry);

    expect(post).toHaveBeenLastCalledWith(
      expect.any(String),
      expect.anything(),
      expect.objectContaining({
        headers: expect.objectContaining({ 'X-Workspace-Id': 'ws-taken-in' }),
      }),
    );
  });
});
