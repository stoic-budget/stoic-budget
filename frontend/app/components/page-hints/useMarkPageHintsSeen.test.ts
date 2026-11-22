import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { setDemoStatusForTests } from '@/app/hooks/useDemoStatus';
import { useMarkPageHintsSeen } from './useMarkPageHintsSeen';

const PAGE = 'budgets';
const VERSION = 2;

const mocks = vi.hoisted(() => ({ setUser: vi.fn(), post: vi.fn() }));

vi.mock('@/app/hooks/useAuth', () => ({ useAuth: () => ({ setUser: mocks.setUser }) }));
vi.mock('@/app/lib/api', () => ({ default: { post: mocks.post } }));
vi.mock('@/app/lib/query-fn-schema', () => ({
  checkContract: async (_name: string, payload: unknown) => payload,
}));

describe('useMarkPageHintsSeen', () => {
  afterEach(() => {
    mocks.setUser.mockReset();
    mocks.post.mockReset();
    act(() => setDemoStatusForTests(null));
  });

  it('closes the hints locally and records them on the server', () => {
    mocks.post.mockResolvedValue({ data: { pageHintsSeen: { [PAGE]: VERSION } } });
    const { result } = renderHook(() => useMarkPageHintsSeen());

    result.current(PAGE, VERSION);

    expect(mocks.setUser).toHaveBeenCalled();
    expect(mocks.post).toHaveBeenCalledWith('/users/me/page-hints', { page: PAGE, version: VERSION });
  });

  it('on a demo server closes them for this visitor only', () => {
    act(() => setDemoStatusForTests({ enabled: true, account: null }));
    const { result } = renderHook(() => useMarkPageHintsSeen());

    result.current(PAGE, VERSION);

    expect(mocks.setUser).toHaveBeenCalledTimes(1);
    expect(mocks.post).not.toHaveBeenCalled();
  });
});
