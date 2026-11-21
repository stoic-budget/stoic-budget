import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { User } from '@/app/hooks/useAuth';
import { setDemoStatusForTests } from '@/app/hooks/useDemoStatus';
import { THEME_STORAGE_EVENT } from '@/app/lib/theme-preference';
import { currentUser } from '@/app/test/fixtures/contracts';
import { useAppearance } from './useAppearance';

const mocks = vi.hoisted(() => ({ patch: vi.fn(), setUser: vi.fn() }));

vi.mock('@/app/lib/api', () => ({ default: { patch: mocks.patch } }));
vi.mock('@/app/lib/query-fn-schema', () => ({
  checkContract: async (_name: string, payload: unknown) => payload,
}));

const USER = currentUser({ name: 'Member One', uiDensity: 'comfortable' }) as User;
const MESSAGES = { successFallback: 'Saved', errorFallback: 'Not saved' };

function renderAppearance() {
  return renderHook(() => useAppearance(USER, mocks.setUser, MESSAGES));
}

describe('useAppearance', () => {
  afterEach(() => {
    mocks.patch.mockReset();
    mocks.setUser.mockReset();
    localStorage.clear();
    act(() => setDemoStatusForTests(null));
  });

  it('saves a setting on an ordinary server', async () => {
    mocks.patch.mockResolvedValue({ data: { user: { ...USER, uiDensity: 'compact' } } });
    const { result } = renderAppearance();

    await act(async () => {
      result.current.setDensity('compact');
    });

    expect(mocks.patch).toHaveBeenCalledWith('/users/me/preferences', { uiDensity: 'compact' });
    expect(mocks.setUser).toHaveBeenCalledWith(expect.objectContaining({ uiDensity: 'compact' }));
    expect(result.current.appearanceMessage).toBe(MESSAGES.successFallback);
  });

  it('on a demo applies a setting here without asking the server', async () => {
    act(() => setDemoStatusForTests({ enabled: true, account: null }));
    const { result } = renderAppearance();

    await act(async () => {
      result.current.setDensity('compact');
    });

    expect(mocks.patch).not.toHaveBeenCalled();
    expect(mocks.setUser).toHaveBeenCalledWith(expect.objectContaining({ uiDensity: 'compact' }));
    expect(result.current.density).toBe('compact');
    expect(result.current.appearanceError).toBeNull();
  });

  it('on a demo switches the theme here without asking the server', async () => {
    act(() => setDemoStatusForTests({ enabled: true, account: null }));
    const heard: unknown[] = [];
    const listener = (event: Event) => heard.push((event as CustomEvent).detail);
    window.addEventListener(THEME_STORAGE_EVENT, listener);
    const { result } = renderAppearance();

    await act(async () => {
      await result.current.handleThemePreferenceChange('dark');
    });
    window.removeEventListener(THEME_STORAGE_EVENT, listener);

    expect(mocks.patch).not.toHaveBeenCalled();
    expect(heard).toEqual([{ themePreference: 'dark' }]);
    expect(result.current.themePreference).toBe('dark');
    expect(JSON.parse(localStorage.getItem('user') ?? '{}').themePreference).toBe('dark');
  });
});
