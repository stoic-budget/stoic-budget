// @vitest-environment jsdom
import { act } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChangelogEntry } from '@/app/components/ChangelogModal';
import type { User } from '@/app/contexts/AuthContext';
import { renderHookWithQuery } from '@/app/test/query-wrapper';
import { useChangelog } from './useChangelog';

const entry = (id: string, date: string): ChangelogEntry => ({
  id,
  date,
  title: id,
  summary: '',
  markdown: '',
});
const older = entry('changelog-2026-10-01-aaaaaaa', '2026-10-01T09:00:00.000Z');
const newer = entry('changelog-2026-11-01-bbbbbbb', '2026-11-01T09:00:00.000Z');

const mocks = vi.hoisted(() => ({
  user: null as User | null,
  setUser: vi.fn(),
  post: vi.fn(),
}));
vi.mock('@/app/hooks/useAuth', () => ({
  useAuth: () => ({ user: mocks.user, loading: false, setUser: mocks.setUser }),
}));
vi.mock('@/app/lib/changelog-api', () => ({
  fetchLatestChangelogEntry: vi.fn(),
  postChangelogSeen: mocks.post,
}));

describe('useChangelog', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ entries: [newer, older] }))),
    );
    mocks.setUser.mockReset();
    mocks.post.mockReset().mockResolvedValue({
      changelogSeenId: newer.id,
      changelogSeenAt: newer.date,
    });
    mocks.user = {
      id: 'user-1',
      email: 'member-1@example.com',
      name: 'Member One',
      role: 'user',
      changelogSeenId: older.id,
      changelogSeenAt: older.date,
    };
  });

  it('marks an entry seen when it is opened by hand', async () => {
    const { result } = renderHookWithQuery(() => useChangelog(true, true));

    await act(async () => {
      result.current.setChangelogSelectedEntry(newer);
    });

    expect(result.current.changelogSelectedEntry).toEqual(newer);
    expect(mocks.post).toHaveBeenCalledWith(newer);
  });

  it('sends nothing for an entry older than the marker, or on close', async () => {
    const { result } = renderHookWithQuery(() => useChangelog(true, true));

    await act(async () => {
      result.current.setChangelogSelectedEntry(older);
    });
    await act(async () => {
      result.current.setChangelogSelectedEntry(null);
    });

    expect(mocks.post).not.toHaveBeenCalled();
  });
});
