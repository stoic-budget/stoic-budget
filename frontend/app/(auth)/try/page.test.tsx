import { act, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiResponse } from '@/app/test/api-response';
import { authUser } from '@/app/test/fixtures/contracts';

const apiPost = vi.hoisted(() => vi.fn());

vi.mock('@/app/lib/api', () => ({
  __esModule: true,
  default: { get: vi.fn(), post: apiPost },
}));

vi.mock('@/app/i18n', () => ({
  useLocale: () => ({ locale: 'en' }),
  useIntlayer: () => ({
    title: 'Try the demo',
    features: {},
    preparing: 'Preparing a demo with sample data…',
    busy: 'The demo is full right now.',
    unavailable: 'This server does not offer a demo.',
    failed: 'Could not start the demo.',
    submit: 'Log in',
    rightTagline: 'Tagline',
  }),
}));

vi.mock('@/app/components/AuthLanguageSwitcher', () => ({
  AuthLanguageSwitcher: () => <div />,
}));

import TryDemoPage from './page';

const httpError = (status: number) => Object.assign(new Error(`HTTP ${status}`), {
  isAxiosError: true,
  response: { status, data: {} },
});

describe('TryDemoPage', () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;
  const location = window.location;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    apiPost.mockReset();
    localStorage.clear();
    Object.defineProperty(window, 'location', { configurable: true, value: { href: '' } });
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    Object.defineProperty(window, 'location', { configurable: true, value: location });
  });

  const render = async () => {
    await act(async () => {
      root.render(
        <StrictMode>
          <TryDemoPage />
        </StrictMode>,
      );
    });
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });
  };

  it('asks for one guest, even under StrictMode, and opens the app as it', async () => {
    const guest = authUser({ workspaceId: 'workspace-demo' });
    apiPost.mockResolvedValue(apiResponse({ user: guest }));

    await render();

    expect(apiPost).toHaveBeenCalledTimes(1);
    expect(apiPost).toHaveBeenCalledWith('/auth/demo');
    expect(JSON.parse(localStorage.getItem('user') ?? 'null')).toEqual(guest);
    expect(localStorage.getItem('currentWorkspaceId')).toBe('workspace-demo');
    expect(window.location.href).toBe('/dashboard');
  });

  it.each([
    [503, 'The demo is full right now.'],
    [429, 'The demo is full right now.'],
    [404, 'This server does not offer a demo.'],
    [500, 'Could not start the demo.'],
  ])('tells the visitor why a %i left them outside', async (status, message) => {
    apiPost.mockRejectedValue(httpError(status));

    await render();

    expect(container.querySelector('[role="alert"]')?.textContent).toBe(message);
    expect(window.location.href).toBe('');
  });
});
