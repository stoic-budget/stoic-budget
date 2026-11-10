import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CurrentUser } from '@/app/lib/contracts';
import { apiResponse } from '@/app/test/api-response';
import { currentUser } from '@/app/test/fixtures/contracts';

const { apiPost, params } = vi.hoisted(() => ({
  apiPost: vi.fn(),
  params: new Map<string, string>(),
}));

vi.mock('@/app/lib/api', () => ({ __esModule: true, default: { post: apiPost } }));
vi.mock('next/navigation', () => ({
  useSearchParams: () => ({ get: (key: string) => params.get(key) ?? null }),
}));
vi.mock('@/app/lib/api-error', () => ({
  getApiErrorMessage: (_error: unknown, fallback: string) => fallback,
  translateErrorCode: (code: string) =>
    ({ OIDC_REAUTH_NOT_FRESH: 'The provider did not confirm a fresh sign-in' })[code],
}));
vi.mock('@/app/i18n', () => {
  const text = (value: string) => Object.assign([value], { value, toString: () => value });
  return {
    useIntlayer: () => ({
      intro: text('Your account has no password yet.'),
      steps: text('First sign in with your provider again.'),
      start: text('Set a password'),
      returnedNote: text('You signed in again.'),
      submit: text('Save password'),
      restart: text('Sign in again'),
      doneMessage: text('Password set.'),
      errorFallback: text('The password could not be set.'),
      loading: text('Loading'),
    }),
  };
});

import { useSetPassword } from '@/app/settings/profile/hooks/useSetPassword';
import { SetPasswordSection } from './SetPasswordSection';

const LABELS: Record<string, string> = {
  newPasswordLabel: 'New password',
  newPasswordHelp: 'At least 8 characters',
  confirmPasswordLabel: 'Confirm password',
  passwordMismatch: 'Passwords do not match',
};

function Harness({ onUser }: { onUser: (user: CurrentUser) => void }) {
  const setPassword = useSetPassword(onUser, { errorFallback: 'The password could not be set.' });
  return <SetPasswordSection tx={path => LABELS[path.at(-1) as string]} setPassword={setPassword} />;
}

describe('SetPasswordSection', () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;
  const onUser = vi.fn();

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
    await act(async () => root.render(<Harness onUser={onUser} />));
  };
  const button = (label: string) =>
    [...container.querySelectorAll('button')].find(item => item.textContent === label) as HTMLButtonElement;
  const type = async (id: string, value: string) => {
    const input = container.querySelector(`#${id}`) as HTMLInputElement;
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    await act(async () => {
      setValue?.call(input, value);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
  };

  it('starts with the provider sign-in, not with password fields', async () => {
    apiPost.mockResolvedValue(apiResponse({ url: 'https://login.example.com/authorize?prompt=login' }));
    const assign = vi.fn();
    Object.defineProperty(window, 'location', { configurable: true, value: { ...window.location, assign } });
    await render();
    expect(container.querySelector('input[type="password"]')).toBeNull();
    await act(async () => button('Set a password').click());
    expect(apiPost).toHaveBeenCalledWith('/auth/oidc/reauth');
    expect(assign).toHaveBeenCalledWith('https://login.example.com/authorize?prompt=login');
  });

  it('back from the provider: refuses a mismatch, then sets the password and hides the fields', async () => {
    params.set('reauth', 'ok');
    const answered = currentUser({ passwordSet: true });
    apiPost.mockResolvedValue(apiResponse({ user: answered }));
    await render();
    expect(container.textContent).toContain('You signed in again.');
    await type('set-password-next', 'Fresh-Passw0rd!');
    await type('set-password-confirm', 'Fresh-Passw0rd?');
    await act(async () => button('Save password').click());
    expect(container.textContent).toContain('Passwords do not match');
    expect(apiPost).not.toHaveBeenCalled();

    await type('set-password-confirm', 'Fresh-Passw0rd!');
    await act(async () => button('Save password').click());
    expect(apiPost).toHaveBeenCalledWith('/auth/password/set', { newPassword: 'Fresh-Passw0rd!' });
    expect(onUser).toHaveBeenCalledWith(answered);
    expect(container.textContent).toContain('Password set.');
    expect(container.querySelector('input[type="password"]')).toBeNull();
  });

  it('keeps the form and offers a new sign-in when the server refuses', async () => {
    params.set('reauth', 'ok');
    apiPost.mockRejectedValue(new Error('403'));
    await render();
    await type('set-password-next', 'Fresh-Passw0rd!');
    await type('set-password-confirm', 'Fresh-Passw0rd!');
    await act(async () => button('Save password').click());
    expect(container.textContent).toContain('The password could not be set.');
    expect(onUser).not.toHaveBeenCalled();
    expect(button('Sign in again')).toBeDefined();
  });

  it('shows why the provider sign-in was refused', async () => {
    params.set('reauthError', 'OIDC_REAUTH_NOT_FRESH');
    await render();
    expect(container.textContent).toContain('The provider did not confirm a fresh sign-in');
    expect(button('Set a password')).toBeDefined();
  });
});
