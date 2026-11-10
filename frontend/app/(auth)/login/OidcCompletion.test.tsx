import { act, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiResponse } from '@/app/test/api-response';
import { authUser } from '@/app/test/fixtures/contracts';

const { apiPost, finishSignIn } = vi.hoisted(() => ({ apiPost: vi.fn(), finishSignIn: vi.fn() }));

vi.mock('@/app/lib/api', () => ({ __esModule: true, default: { post: apiPost } }));
vi.mock('@/app/lib/finish-sign-in', () => ({ finishSignIn }));
vi.mock('@/app/i18n', () => ({
  useIntlayer: () => ({
    completing: 'Signing you in…',
    failed: { value: 'Single sign-on did not work.' },
    continue: 'Continue',
    backToPassword: 'Sign in with a password instead',
    twoFactorLabel: 'Code',
    twoFactorHint: 'From your authenticator app',
  }),
}));

import { OidcCompletion } from './OidcCompletion';

describe('OidcCompletion', () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    apiPost.mockReset();
    finishSignIn.mockReset();
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  const render = async () => {
    await act(async () => {
      root.render(
        <StrictMode>
          <OidcCompletion nextPath="/reports" inviteToken={null} />
        </StrictMode>,
      );
    });
  };

  it('asks for the sign-in once, even when effects run twice, and then signs in', async () => {
    const user = authUser();
    apiPost.mockResolvedValue(apiResponse({ user }));
    await render();
    expect(apiPost).toHaveBeenCalledTimes(1);
    expect(apiPost).toHaveBeenCalledWith('/auth/oidc/complete', {});
    expect(finishSignIn).toHaveBeenCalledWith(user, { inviteToken: null, nextPath: '/reports' });
  });

  it('asks for the second factor and sends it', async () => {
    const user = authUser();
    apiPost
      .mockResolvedValueOnce(apiResponse({ twoFactorRequired: true }))
      .mockResolvedValueOnce(apiResponse({ user }));
    await render();
    const input = container.querySelector('#oidcTwoFactorCode') as HTMLInputElement;
    expect(input).not.toBeNull();
    expect(finishSignIn).not.toHaveBeenCalled();

    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      setter?.call(input, ' 123456 ');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () => {
      container.querySelector('form')?.requestSubmit();
    });
    expect(apiPost).toHaveBeenLastCalledWith('/auth/oidc/complete', { twoFactorCode: '123456' });
    expect(finishSignIn).toHaveBeenCalledWith(user, { inviteToken: null, nextPath: '/reports' });
  });

  it('tells a failure and offers the password instead', async () => {
    apiPost.mockRejectedValue(new Error('The sign-in took too long. Start again'));
    await render();
    expect(container.querySelector('[role="alert"]')?.textContent).toBe(
      'The sign-in took too long. Start again',
    );
    expect(container.querySelector('a[href="/login"]')?.textContent).toBe('Sign in with a password instead');
  });
});
