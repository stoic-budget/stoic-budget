// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import type React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { EMPTY_GOAL_FORM, useGoals } from './useGoals';

const api = vi.hoisted(() => ({ post: vi.fn(), put: vi.fn(), delete: vi.fn() }));
const toast = vi.hoisted(() => ({ error: vi.fn() }));
vi.mock('@/app/lib/api', () => ({ default: api }));
vi.mock('react-hot-toast', () => ({ default: toast }));
vi.mock('@/app/hooks/useWorkspaceId', () => ({ useWorkspaceId: () => 'ws-1' }));
vi.mock('@/app/lib/query-fn-schema', () => ({
  apiQueryDecoded: vi.fn(async () => []),
  checkContract: vi.fn(async (_name: string, data: unknown) => data),
}));

const texts = { saveFailed: 'Could not save the goal', coverFailed: 'Picture not set' };
const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>
);

describe('useGoals failures', () => {
  it('says so when a save fails, instead of swallowing it', async () => {
    api.post.mockRejectedValueOnce({ status: 0 });
    const { result } = renderHook(() => useGoals(texts), { wrapper });

    let saved = true;
    await act(async () => {
      saved = await result.current.createGoal({ ...EMPTY_GOAL_FORM, name: 'Bike' });
    });

    expect(saved).toBe(false);
    expect(toast.error).toHaveBeenCalledWith('Could not save the goal');
  });

  it('keeps a saved goal saved when only its picture fails', async () => {
    toast.error.mockClear();
    api.post.mockResolvedValueOnce({ data: { id: 'goal-1' } });
    api.put.mockRejectedValueOnce({ status: 0 });
    const { result } = renderHook(() => useGoals(texts), { wrapper });

    let saved = false;
    await act(async () => {
      saved = await result.current.createGoal({
        ...EMPTY_GOAL_FORM,
        name: 'Bike',
        cover: { kind: 'preset', preset: 'mountains' } as never,
      });
    });

    expect(saved).toBe(true);
    expect(toast.error).toHaveBeenCalledWith('Picture not set');
  });
});
