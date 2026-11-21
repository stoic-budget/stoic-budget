// @vitest-environment jsdom
import { act, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CalendarFeedSettings } from '@/app/lib/contracts';
import { queryKeys } from '@/app/lib/query-keys';
import { apiResponse } from '@/app/test/api-response';
import { createTestQueryClient, renderHookWithQuery } from '@/app/test/query-wrapper';

const workspace = vi.hoisted(() => ({ id: 'workspace-a' as string | null }));
const api = vi.hoisted(() => ({ post: vi.fn(), get: vi.fn() }));

vi.mock('@/app/hooks/useWorkspaceId', () => ({ useWorkspaceId: () => workspace.id }));
vi.mock('@/app/lib/api', () => ({ default: api }));
vi.mock('@/app/lib/query-fn-schema', () => ({
  // Both workspaces start with the feed off.
  apiQueryDecoded: vi.fn(async () => ({ ...SETTINGS, enabled: false, createdAt: null })),
  checkContract: (_name: string, payload: unknown) => payload,
}));

import { useCalendarFeed } from './useCalendarFeed';

const SETTINGS: CalendarFeedSettings = {
  enabled: true,
  include: { payables: true, subscriptions: true, taxDeadlines: true, invoices: true },
  createdAt: '2026-11-01T08:00:00.000Z',
  lastFetchedAt: null,
};
const TOKEN = 'feedTokenForWorkspaceA_0123456789ab';

describe('useCalendarFeed', () => {
  beforeEach(() => {
    workspace.id = 'workspace-a';
    api.post.mockResolvedValue(apiResponse({ ...SETTINGS, token: TOKEN }));
  });

  it("does not show one workspace's new link after switching to another", async () => {
    const client = createTestQueryClient();
    const { result, rerender } = renderHookWithQuery(() => useCalendarFeed(), { client });
    act(() => result.current.issueLink());
    await waitFor(() => expect(result.current.token).toBe(TOKEN));

    workspace.id = 'workspace-b';
    rerender();
    expect(result.current.token).toBeNull();

    workspace.id = 'workspace-a';
    rerender();
    expect(result.current.token).toBe(TOKEN);
  });

  it('keeps the settings of a new link under the workspace it was made in', async () => {
    const client = createTestQueryClient();
    let answer: (value: unknown) => void = () => undefined;
    api.post.mockReturnValue(new Promise(resolve => (answer = resolve)));
    const { result, rerender } = renderHookWithQuery(() => useCalendarFeed(), { client });
    act(() => result.current.issueLink());
    // The member switches workspace while the link is being made.
    workspace.id = 'workspace-b';
    rerender();
    await waitFor(() =>
      expect(client.getQueryData(queryKeys.calendarFeed('workspace-b'))).toBeDefined(),
    );
    answer(apiResponse({ ...SETTINGS, token: TOKEN }));
    await waitFor(() => expect(result.current.issue.isSuccess).toBe(true));
    expect(client.getQueryData(queryKeys.calendarFeed('workspace-a'))).toEqual(SETTINGS);
    expect(client.getQueryData(queryKeys.calendarFeed('workspace-b'))).toMatchObject({
      enabled: false,
    });
    expect(result.current.token).toBeNull();
  });
});
