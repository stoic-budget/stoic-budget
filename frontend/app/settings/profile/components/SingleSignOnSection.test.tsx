import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiResponse } from '@/app/test/api-response';

const { apiGet, apiPost, apiDelete, params } = vi.hoisted(() => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiDelete: vi.fn(),
  params: new Map<string, string>(),
}));

vi.mock('@/app/lib/api', () => ({
  __esModule: true,
  default: { get: apiGet, post: apiPost, delete: apiDelete },
}));
vi.mock('next/navigation', () => ({ useSearchParams: () => ({ get: (key: string) => params.get(key) ?? null }) }));
vi.mock('@/app/i18n', () => {
  const text = (value: string) => Object.assign([value], { value, toString: () => value });
  return {
    useIntlayer: () => ({
      title: text('Single sign-on'),
      description: text('Sign in with your organisation’s account'),
      link: text('Link an account'),
      unlink: text('Unlink'),
      empty: text('No account is linked yet.'),
      linkedLabel: text('Linked'),
      lastUsedLabel: text('Last used'),
      neverUsed: text('Not used yet'),
      linkedMessage: text('Account linked.'),
      unlinkedMessage: text('Account unlinked.'),
      unlinkConfirm: text('Unlink this account?'),
      lastMethodHint: text('This is your only way to sign in.'),
      linkNeedsPassword: text('Linking asks for your password.'),
      loadError: text('Could not load'),
      actionError: text('Could not change'),
      // The spinner of the password prompt reads its own dictionary through the same mock.
      loading: text('Loading'),
    }),
  };
});

import { SingleSignOnSection } from './SingleSignOnSection';

const identity = {
  id: '00000000-0000-4000-8000-000000000001',
  issuer: 'https://login.example.com',
  email: 'member-1@example.com',
  createdAt: '2026-11-01T10:00:00.000Z',
  lastUsedAt: null,
};
const listOf = (overrides: object) => ({
  passwordSet: true,
  providerEnabled: true,
  buttonLabel: 'ACME Login',
  identities: [identity],
  ...overrides,
});

describe('SingleSignOnSection', () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    vi.clearAllMocks();
    params.clear();
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  const render = async () => {
    await act(async () => {
      root.render(
        <SingleSignOnSection
          openSection="single-sign-on"
          formatPreferences={{} as never}
          tx={path => (path.at(-1) === 'cancelButton' ? 'Cancel' : 'Current password')}
        />,
      );
    });
  };
  const button = (label: string) =>
    [...container.querySelectorAll('button')].find(item => item.textContent === label) as HTMLButtonElement;

  it('stays hidden while the server has no provider and nothing is linked', async () => {
    apiGet.mockResolvedValue(apiResponse(listOf({ providerEnabled: false, identities: [] })));
    await render();
    expect(container.textContent).toBe('');
  });

  it('keeps the last way in of an account without a password', async () => {
    apiGet.mockResolvedValue(apiResponse(listOf({ passwordSet: false })));
    await render();
    expect(container.textContent).toContain('member-1@example.com');
    expect(button('Unlink').disabled).toBe(true);
    expect(container.textContent).toContain('This is your only way to sign in.');
    // Linking asks for a password this account does not have.
    expect(button('Link an account')).toBeUndefined();
    expect(container.textContent).toContain('Linking asks for your password.');
  });

  it('unlinks after asking, and shows the list the server answered', async () => {
    apiGet.mockResolvedValue(apiResponse(listOf({})));
    apiDelete.mockResolvedValue(apiResponse(listOf({ identities: [] })));
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    await render();
    await act(async () => button('Unlink').click());
    expect(apiDelete).toHaveBeenCalledWith(`/auth/oidc/identities/${identity.id}`);
    expect(container.textContent).toContain('Account unlinked.');
    expect(container.textContent).toContain('No account is linked yet.');
  });

  it('goes to the provider to link an account after the current password', async () => {
    apiGet.mockResolvedValue(apiResponse(listOf({ identities: [] })));
    apiPost.mockResolvedValue(apiResponse({ url: 'https://login.example.com/authorize?state=x' }));
    const assign = vi.fn();
    Object.defineProperty(window, 'location', { configurable: true, value: { ...window.location, assign } });
    await render();
    await act(async () => button('Link an account').click());
    // Nothing is sent before the current password.
    expect(apiPost).not.toHaveBeenCalled();
    const input = container.querySelector('input[type="password"]') as HTMLInputElement;
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    await act(async () => {
      setValue?.call(input, 'Member-1 password');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () => button('Link an account').click());
    expect(apiPost).toHaveBeenCalledWith('/auth/oidc/link', { password: 'Member-1 password' });
    expect(assign).toHaveBeenCalledWith('https://login.example.com/authorize?state=x');
  });

  it('says so when the provider sent the browser back linked', async () => {
    params.set('oidc', 'linked');
    apiGet.mockResolvedValue(apiResponse(listOf({})));
    await render();
    expect(container.textContent).toContain('Account linked.');
  });
});
