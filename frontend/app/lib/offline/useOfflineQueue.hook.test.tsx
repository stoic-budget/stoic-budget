import { act, renderHook } from '@testing-library/react';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryStore, type OfflineEntry } from './offline-queue';
import { useOfflineQueue } from './useOfflineQueue';

const post = vi.hoisted(() => vi.fn());
const auth = vi.hoisted(() => ({ user: null as { id: string } | null }));
vi.mock('@/app/lib/api', () => ({ default: { post } }));
vi.mock('@/app/hooks/useAuth', () => ({ useAuth: () => auth }));
vi.mock('@/app/contexts/WorkspaceContext', () => ({
  useReadOnlyWorkspace: () => ({ isReadOnly: false }),
}));

const entry: OfflineEntry = {
  id: 'e1',
  kind: 'receipt-scan',
  createdAt: '2026-10-01T08:00:00.000Z',
  fields: {},
  files: [],
  userId: 'member-one',
  attempts: 0,
};
const settle = () => act(() => new Promise(resolve => setTimeout(resolve, 50)));

/** When the queue is sent (#784): never signed out, once per sign-in. */
describe('useOfflineQueue', () => {
  const saved = globalThis.indexedDB;
  beforeAll(() => {
    // The store is passed in; this only tells the hook a store exists.
    Object.defineProperty(globalThis, 'indexedDB', { value: {}, configurable: true });
  });
  afterAll(() => {
    Object.defineProperty(globalThis, 'indexedDB', { value: saved, configurable: true });
  });
  beforeEach(() => {
    post.mockReset();
    // One entry that keeps failing for the session: nothing removes it.
    post.mockRejectedValue({ isAxiosError: true, response: { status: 401, data: {} } });
    auth.user = null;
  });

  it('sends nothing while nobody is signed in, and once when someone signs in', async () => {
    const store = createMemoryStore([entry]);
    const { rerender } = renderHook(() => useOfflineQueue(store));
    await settle();
    // The network coming back on the login page does not send it either.
    await act(async () => {
      window.dispatchEvent(new Event('online'));
    });
    await settle();
    expect(post).not.toHaveBeenCalled();

    auth.user = { id: 'member-one' };
    rerender();
    await settle();
    expect(post).toHaveBeenCalledTimes(1);
  });

  it('sends once when the app opens signed in', async () => {
    auth.user = { id: 'member-one' };
    const store = createMemoryStore([entry]);
    renderHook(() => useOfflineQueue(store));
    await settle();
    expect(post).toHaveBeenCalledTimes(1);
  });
});
