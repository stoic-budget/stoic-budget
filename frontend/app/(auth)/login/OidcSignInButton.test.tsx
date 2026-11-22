import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiResponse } from '@/app/test/api-response';

const { apiGet, apiPost, params } = vi.hoisted(() => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  params: new Map<string, string>(),
}));

vi.mock('@/app/lib/api', () => ({ __esModule: true, default: { get: apiGet, post: apiPost } }));
vi.mock('next/navigation', () => ({ useSearchParams: () => ({ get: (key: string) => params.get(key) ?? null }) }));
vi.mock('@/app/lib/api-error', () => ({
  getApiErrorMessage: (_error: unknown, fallback: string) => fallback,
  translateErrorCode: (code: string) => (code === 'OIDC_ACCOUNT_EXISTS' ? 'Sign in with your password first' : undefined),
}));
vi.mock('@/app/i18n', () => ({
  useIntlayer: () => ({
    or: 'or',
    defaultButton: 'Sign in with single sign-on',
    failed: { value: 'Single sign-on did not work.' },
  }),
}));

import { OidcSignInButton } from './OidcSignInButton';

describe('OidcSignInButton', () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    apiGet.mockReset();
    apiPost.mockReset();
    params.clear();
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  const render = async (nextPath: string | null = null) => {
    await act(async () => {
      root.render(<OidcSignInButton nextPath={nextPath} />);
    });
  };

  it('shows nothing when the server offers no single sign-on', async () => {
    apiGet.mockResolvedValue(apiResponse({ enabled: false, buttonLabel: null }));
    await render();
    expect(container.textContent).toBe('');
  });

  it('starts the sign-in with the page to return to, then opens the provider', async () => {
    apiGet.mockResolvedValue(apiResponse({ enabled: true, buttonLabel: 'ACME Login' }));
    apiPost.mockResolvedValue(apiResponse({ url: 'https://login.example.com/authorize?state=x' }));
    const assign = vi.fn();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...window.location, assign },
    });
    await render('/reports');
    const button = container.querySelector('button');
    expect(button?.textContent).toBe('ACME Login');
    await act(async () => button?.click());
    expect(apiPost).toHaveBeenCalledWith('/auth/oidc/start', { next: '/reports' });
    expect(assign).toHaveBeenCalledWith('https://login.example.com/authorize?state=x');
  });

  it('falls back to the default label', async () => {
    apiGet.mockResolvedValue(apiResponse({ enabled: true, buttonLabel: null }));
    await render();
    expect(container.querySelector('button')?.textContent).toBe('Sign in with single sign-on');
  });

  it('tells why a sign-in failed, by code, and nothing someone wrote into the link', async () => {
    apiGet.mockResolvedValue(apiResponse({ enabled: false, buttonLabel: null }));
    params.set('oidcError', 'OIDC_ACCOUNT_EXISTS');
    await render();
    expect(container.querySelector('[role="alert"]')?.textContent).toBe('Sign in with your password first');

    params.set('oidcError', 'Your account is locked, call 555-0100');
    await render();
    expect(container.querySelector('[role="alert"]')?.textContent).toBe('Single sign-on did not work.');
  });
});
