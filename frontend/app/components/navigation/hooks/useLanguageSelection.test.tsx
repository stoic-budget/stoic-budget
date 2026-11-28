import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useLanguageSelection } from './useLanguageSelection';

const saveWorkspaceLocale = vi.hoisted(() => vi.fn());
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));

vi.mock('@/app/contexts/WorkspaceContext', () => ({
  useWorkspace: () => ({ currentWorkspace: { id: 'ws-current' } }),
}));
vi.mock('@/app/lib/workspace-locale-api', () => ({ saveWorkspaceLocale }));
vi.mock('react-hot-toast', () => ({ default: toast }));

const languageModal = {
  defaultLanguageNote: { value: 'Default' },
  savedToastPrefix: { value: 'Language' },
};

function renderSelection(setLocale: (code: string) => void) {
  return renderHook(() =>
    useLanguageSelection({
      locale: 'en',
      availableLocales: ['en', 'de'],
      setLocale,
      languageModal,
      setMobileMenuOpen: () => {},
    }),
  );
}

describe('useLanguageSelection', () => {
  const originalLocation = window.location;
  const reload = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    reload.mockReset();
    saveWorkspaceLocale.mockReset();
    toast.success.mockReset();
    toast.error.mockReset();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...originalLocation, reload },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    Object.defineProperty(window, 'location', { configurable: true, value: originalLocation });
  });

  it('saves the language for the current workspace, then switches and reloads', async () => {
    const setLocale = vi.fn();
    saveWorkspaceLocale.mockResolvedValue(undefined);
    const { result } = renderSelection(setLocale);

    await act(async () => {
      result.current.handleLanguageSelect('de');
    });
    act(() => {
      vi.runAllTimers();
    });

    expect(saveWorkspaceLocale).toHaveBeenCalledWith('ws-current', 'de');
    expect(setLocale).toHaveBeenCalledWith('de');
    expect(reload).toHaveBeenCalled();
  });

  it('keeps the language and says so when the save is refused', async () => {
    const setLocale = vi.fn();
    saveWorkspaceLocale.mockRejectedValue(new Error('offline'));
    const { result } = renderSelection(setLocale);

    await act(async () => {
      result.current.handleLanguageSelect('de');
    });
    act(() => {
      vi.runAllTimers();
    });

    expect(setLocale).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
  });
});
