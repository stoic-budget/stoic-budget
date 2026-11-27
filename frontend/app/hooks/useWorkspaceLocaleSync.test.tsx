import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { persistLocaleToCookie } from '@/app/lib/locale';
import { apiResponse } from '@/app/test/api-response';
import { setDemoStatusForTests } from './useDemoStatus';
import { useWorkspaceLocaleSync } from './useWorkspaceLocaleSync';

type TestWorkspace = { id: string; kind?: 'standard' | 'version'; memberLocale?: string | null };

const state = vi.hoisted(() => ({ current: null as TestWorkspace | null }));
// The real provider writes the cookie; the next sync reads it.
const setLocale = vi.hoisted(() => vi.fn());
const put = vi.hoisted(() => vi.fn());
// What useLocale hands out; intlayer replaces it whenever the language changes.
const localeApi = vi.hoisted(() => ({ setLocale: (_code: string) => {} }));

vi.mock('@/app/contexts/WorkspaceContext', () => ({
  useWorkspace: () => ({ currentWorkspace: state.current }),
}));
vi.mock('@/app/i18n', () => ({ useLocale: () => ({ setLocale: localeApi.setLocale }) }));
vi.mock('@/app/lib/api', () => ({ api: { put } }));

function Harness() {
  useWorkspaceLocaleSync();
  return null;
}

describe('useWorkspaceLocaleSync', () => {
  let container: HTMLDivElement;
  let root: Root;

  const enter = async (workspace: TestWorkspace) => {
    state.current = workspace;
    await act(async () => {
      root.render(<Harness key={workspace.id} />);
    });
  };

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    setLocale.mockReset().mockImplementation(persistLocaleToCookie);
    localeApi.setLocale = setLocale;
    put.mockReset().mockImplementation(async (_url: string, body: { locale: string }) =>
      apiResponse({ locale: body.locale }),
    );
    container = document.createElement('div');
    root = createRoot(container);
  });

  afterEach(() => {
    setDemoStatusForTests(null);
    act(() => {
      root.unmount();
    });
  });

  it("switches to the language the caller chose in the workspace they enter", async () => {
    persistLocaleToCookie('uk');

    await enter({ id: 'ws-chosen', memberLocale: 'en' });

    expect(setLocale).toHaveBeenCalledWith('en');
    expect(put).not.toHaveBeenCalled();
  });

  it("keeps each workspace's language apart when moving between them", async () => {
    const home = { id: 'ws-home', memberLocale: null };
    const fresh = { id: 'ws-fresh', memberLocale: 'uk' };
    persistLocaleToCookie('en');

    // No language yet: the one in use becomes this workspace's.
    await enter(home);
    expect(put).toHaveBeenCalledWith('/workspaces/ws-home/locale', { locale: 'en' });
    expect(setLocale).not.toHaveBeenCalled();

    await enter(fresh);
    expect(setLocale).toHaveBeenLastCalledWith('uk');

    // The list still says null for home: the saved choice wins, Ukrainian does not leak in.
    await enter(home);
    expect(setLocale).toHaveBeenLastCalledWith('en');
    expect(put).toHaveBeenCalledTimes(1);
  });

  it('does not undo a language picked elsewhere, such as the onboarding step', async () => {
    persistLocaleToCookie('en');
    await enter({ id: 'ws-onboarding', memberLocale: 'en' });

    // The step switches language without saving it here; intlayer hands out a new setLocale.
    persistLocaleToCookie('de');
    localeApi.setLocale = (code: string) => setLocale(code);
    await act(async () => {
      root.render(<Harness key="ws-onboarding" />);
    });

    expect(setLocale).not.toHaveBeenCalled();
  });

  it('keeps a language picked right after the workspace adopted one (first-run onboarding)', async () => {
    persistLocaleToCookie('en');
    await enter({ id: 'ws-first-run', memberLocale: null });
    expect(put).toHaveBeenCalledWith('/workspaces/ws-first-run/locale', { locale: 'en' });

    persistLocaleToCookie('de');
    localeApi.setLocale = (code: string) => setLocale(code);
    await act(async () => {
      root.render(<Harness key="ws-first-run" />);
    });

    expect(setLocale).not.toHaveBeenCalled();
  });

  it('keeps the language for the session only on a demo server, which refuses writes', async () => {
    setDemoStatusForTests({ enabled: true, account: null });
    persistLocaleToCookie('en');

    await enter({ id: 'ws-demo', memberLocale: null });
    await enter({ id: 'ws-demo-other', memberLocale: 'de' });
    await enter({ id: 'ws-demo', memberLocale: null });

    expect(put).not.toHaveBeenCalled();
    expect(setLocale).toHaveBeenLastCalledWith('en');
  });

  it('leaves the language alone inside a past version', async () => {
    persistLocaleToCookie('de');

    await enter({ id: 'ws-version', kind: 'version', memberLocale: null });

    expect(setLocale).not.toHaveBeenCalled();
    expect(put).not.toHaveBeenCalled();
  });
});
