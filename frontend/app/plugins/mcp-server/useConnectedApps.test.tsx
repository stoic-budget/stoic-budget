// @vitest-environment jsdom
import { QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestQueryClient } from '@/app/test/query-wrapper';

const state = vi.hoisted(() => ({
  memberRole: 'member' as string,
  user: { role: 'user', permissions: [] as string[] },
  fetched: [] as Array<{ url: string; contract: string }>,
  deleted: [] as string[],
}));

vi.mock('@/app/contexts/WorkspaceContext', () => ({
  useWorkspace: () => ({ currentWorkspace: { id: 'ws-1', memberRole: state.memberRole } }),
}));
vi.mock('@/app/hooks/useAuth', () => ({ useAuth: () => ({ user: state.user }) }));
vi.mock('@/app/hooks/useWorkspaceId', () => ({ useWorkspaceId: () => 'ws-1' }));
vi.mock('@/app/lib/api', () => ({
  default: {
    delete: (url: string) => {
      state.deleted.push(url);
      return Promise.resolve({ data: undefined });
    },
  },
}));
vi.mock('@/app/lib/query-fn-schema', () => ({
  apiQueryDecoded: (options: { url: string; contract: string }) => {
    state.fetched.push({ url: options.url, contract: options.contract });
    return Promise.resolve([]);
  },
}));

import { useConnectedApps } from './useConnectedApps';

function renderApps() {
  const client = createTestQueryClient();
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return renderHook(() => useConnectedApps(), { wrapper });
}

describe('useConnectedApps', () => {
  beforeEach(() => {
    state.memberRole = 'member';
    state.user = { role: 'user', permissions: [] };
    state.fetched = [];
    state.deleted = [];
  });

  it('gives a plain member their own apps and disconnects through the own route', async () => {
    const { result } = renderApps();
    await waitFor(() => expect(state.fetched).toHaveLength(1));
    expect(result.current.workspaceWide).toBe(false);
    expect(state.fetched[0]).toEqual({ url: '/mcp-oauth/grants', contract: 'McpOAuthGrantList' });
    await act(async () => result.current.disconnect('grant-1'));
    await waitFor(() => expect(state.deleted).toEqual(['/mcp-oauth/grants/grant-1']));
  });

  it.each([
    ['a workspace owner', 'owner', { role: 'user', permissions: [] }],
    ['a workspace admin', 'admin', { role: 'user', permissions: [] }],
    ['an instance admin', 'member', { role: 'admin', permissions: [] }],
    ['a member who manages API keys', 'member', { role: 'user', permissions: ['api_key.manage'] }],
  ])('gives %s every member’s apps', async (_label, memberRole, user) => {
    state.memberRole = memberRole;
    state.user = user;
    const { result } = renderApps();
    await waitFor(() => expect(state.fetched).toHaveLength(1));
    expect(result.current.workspaceWide).toBe(true);
    expect(state.fetched[0]).toEqual({
      url: '/mcp-oauth/workspace/grants',
      contract: 'McpOAuthWorkspaceGrantList',
    });
    await act(async () => result.current.disconnect('grant-2'));
    await waitFor(() => expect(state.deleted).toEqual(['/mcp-oauth/workspace/grants/grant-2']));
  });

  it('keeps a viewer on their own list', async () => {
    state.memberRole = 'viewer';
    const { result } = renderApps();
    await waitFor(() => expect(state.fetched).toHaveLength(1));
    expect(result.current.workspaceWide).toBe(false);
  });
});
