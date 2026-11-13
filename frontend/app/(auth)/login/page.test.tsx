import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { authUser } from '@/app/test/fixtures/contracts';

const apiPost = vi.hoisted(() => vi.fn());
const getPasskey = vi.hoisted(() => vi.fn());

vi.mock('@/app/lib/webauthn', async importOriginal => ({
  ...(await importOriginal<typeof import('@/app/lib/webauthn')>()),
  passkeysSupported: () => true,
  getPasskey,
}));

vi.mock('@/app/lib/api', () => ({
  __esModule: true,
  default: {
    post: apiPost,
  },
}));

vi.mock('@/app/i18n', () => ({
  useLocale: () => ({ locale: 'en' }),
  useIntlayer: () => ({
    title: 'Welcome back',
    // AuthHero reads its own `authHero` dictionary through the same mock.
    features: {},
    rightTagline: 'A platform for bank statement processing',
    emailLabel: 'Email localized',
    passwordLabel: 'Password',
    submit: 'Log in',
    noAccountPrompt: "Don't have an account?",
    signUp: 'Sign up',
    forgotPassword: 'Forgot your password?',
    showPassword: { value: 'Show password' },
    hidePassword: { value: 'Hide password' },
    loginFailed: { value: 'Failed to log in. Please try again.' },
    twoFactorLabel: 'Verification code',
    twoFactorHint: 'Enter the code',
    orDivider: 'or',
    passkeySignIn: { value: 'Sign in with a passkey' },
    usePasskey: { value: 'Use your passkey' },
    passkeyDismissed: { value: 'The passkey prompt was closed.' },
  }),
}));

vi.mock('@/app/components/AuthLanguageSwitcher', () => ({
  AuthLanguageSwitcher: () => <div data-testid="auth-language-switcher" />,
}));

vi.mock('next/navigation', () => ({
  useSearchParams: () => ({
    get: () => null,
  }),
}));

// Imported once at collection: a dynamic import inside a test spends its
// timeout on the module graph and, timing out, renders into the next test.
import LoginPage from './page';

describe('LoginPage locale persistence', () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;
  let locationHref = '';
  const storage = new Map<string, string>();

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    storage.clear();
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => storage.set(key, value),
        removeItem: (key: string) => storage.delete(key),
        clear: () => storage.clear(),
      },
    });
    document.cookie = 'INTLAYER_LOCALE=; Max-Age=0; path=/';
    document.cookie = 'intlayer-locale=; Max-Age=0; path=/';
    document.cookie = 'INTLAYER_LOCALE=en; path=/';
    document.cookie = 'intlayer-locale=en; path=/';
    apiPost.mockReset();
    locationHref = '';

    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        get href() {
          return locationHref;
        },
        set href(value: string) {
          locationHref = value;
        },
      },
    });
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('keeps the explicitly selected English locale after a successful login', async () => {
    apiPost.mockResolvedValue({
      data: {
        user: authUser({
          locale: 'ru',
          onboardingCompletedAt: '2026-01-01T00:00:00.000Z',
          lastWorkspaceId: 'workspace-1',
        }),
      },
    });

    await act(async () => {
      root.render(<LoginPage />);
      await Promise.resolve();
    });

    const emailInput = container.querySelector('input[name="email"]') as HTMLInputElement | null;
    const passwordInput = container.querySelector(
      'input[name="password"]',
    ) as HTMLInputElement | null;
    const submitButton = Array.from(container.querySelectorAll('button')).find(button =>
      button.textContent?.includes('Log in'),
    ) as HTMLButtonElement | undefined;

    expect(emailInput).toBeTruthy();
    expect(passwordInput).toBeTruthy();
    expect(submitButton).toBeTruthy();
    expect(container.textContent).toContain('Email localized');

    if (!(emailInput && passwordInput && submitButton)) {
      throw new Error('Login form controls were not rendered');
    }

    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      'value',
    )?.set;

    if (!nativeInputValueSetter) {
      throw new Error('Failed to resolve native input value setter');
    }

    await act(async () => {
      nativeInputValueSetter.call(emailInput, 'user@example.com');
      emailInput.dispatchEvent(new Event('input', { bubbles: true }));
      nativeInputValueSetter.call(passwordInput, 'secret');
      passwordInput.dispatchEvent(new Event('input', { bubbles: true }));
      submitButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });

    expect(apiPost).toHaveBeenCalledWith('/auth/login', {
      email: 'user@example.com',
      password: 'secret',
    });
    expect(document.cookie).toContain('INTLAYER_LOCALE=en');
    expect(locationHref).toBe('/dashboard');
  });

  it('redirects users with a workspace to the dashboard after login even without lastWorkspaceId', async () => {
    apiPost.mockResolvedValue({
      data: {
        user: authUser({
          id: 'user-2',
          email: 'admin@example.com',
          name: 'Admin',
          onboardingCompletedAt: '2026-01-01T00:00:00.000Z',
          workspaceId: 'workspace-primary',
        }),
      },
    });

    await act(async () => {
      root.render(<LoginPage />);
      await Promise.resolve();
    });

    const emailInput = container.querySelector('input[name="email"]') as HTMLInputElement | null;
    const passwordInput = container.querySelector(
      'input[name="password"]',
    ) as HTMLInputElement | null;
    const submitButton = Array.from(container.querySelectorAll('button')).find(button =>
      button.textContent?.includes('Log in'),
    ) as HTMLButtonElement | undefined;

    expect(emailInput).toBeTruthy();
    expect(passwordInput).toBeTruthy();
    expect(submitButton).toBeTruthy();

    if (!(emailInput && passwordInput && submitButton)) {
      throw new Error('Login form controls were not rendered');
    }

    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      'value',
    )?.set;

    if (!nativeInputValueSetter) {
      throw new Error('Failed to resolve native input value setter');
    }

    await act(async () => {
      nativeInputValueSetter.call(emailInput, 'admin@example.com');
      emailInput.dispatchEvent(new Event('input', { bubbles: true }));
      nativeInputValueSetter.call(passwordInput, 'secret');
      passwordInput.dispatchEvent(new Event('input', { bubbles: true }));
      submitButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });

    expect(localStorage.getItem('currentWorkspaceId')).toBe('workspace-primary');
    expect(locationHref).toBe('/dashboard');
  });

  it('shows and hides the password, and puts a failed login under the field', async () => {
    apiPost.mockRejectedValue(new Error('Incorrect email or password'));
    await act(async () => {
      root.render(<LoginPage />);
      await Promise.resolve();
    });

    const passwordInput = container.querySelector('input[name="password"]') as HTMLInputElement;
    const toggle = container.querySelector(
      'button[aria-label="Show password"]',
    ) as HTMLButtonElement;
    expect(passwordInput.type).toBe('password');
    await act(async () => {
      toggle.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(passwordInput.type).toBe('text');
    expect(container.querySelector('button[aria-label="Hide password"]')).toBeTruthy();

    const form = container.querySelector('form') as HTMLFormElement;
    await act(async () => {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await Promise.resolve();
      await Promise.resolve();
    });

    const error = container.querySelector('#login-error');
    expect(error?.getAttribute('role')).toBe('alert');
    expect(passwordInput.getAttribute('aria-describedby')).toBe('login-error');
    expect(container.querySelector('.MuiAlert-root')).toBeNull();
  });

  describe('passkeys', () => {
    const options = {
      challenge: 'challenge-1',
      rpId: 'budget.example.co.il',
      timeout: 300000,
      userVerification: 'required' as const,
      allowCredentials: [],
    };
    const assertion = {
      id: 'credential-1',
      rawId: 'credential-1',
      type: 'public-key' as const,
      response: {
        clientDataJSON: 'Y2xpZW50',
        authenticatorData: 'YXV0aA',
        signature: 'c2ln',
        userHandle: null,
      },
      authenticatorAttachment: 'platform' as const,
      clientExtensionResults: {},
    };
    const signedIn = {
      user: authUser({
        onboardingCompletedAt: '2026-01-01T00:00:00.000Z',
        workspaceId: 'workspace-1',
      }),
    };
    const buttonNamed = (label: string) =>
      Array.from(container.querySelectorAll('button')).find(button =>
        button.textContent?.includes(label),
      ) as HTMLButtonElement | undefined;
    const click = async (button: HTMLButtonElement | undefined) => {
      if (!button) throw new Error('Button not rendered');
      await act(async () => {
        button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        for (let i = 0; i < 6; i++) await Promise.resolve();
      });
    };
    const render = async () => {
      await act(async () => {
        root.render(<LoginPage />);
        await Promise.resolve();
      });
    };

    beforeEach(() => {
      getPasskey.mockReset();
    });

    it('signs in with a passkey alone, without an e-mail', async () => {
      apiPost.mockImplementation(async (url: string) => ({
        data: url === '/auth/passkey-login/options' ? options : signedIn,
      }));
      getPasskey.mockResolvedValue(assertion);
      await render();

      await click(buttonNamed('Sign in with a passkey'));

      expect(getPasskey).toHaveBeenCalledWith(options);
      expect(apiPost).toHaveBeenNthCalledWith(1, '/auth/passkey-login/options');
      expect(apiPost).toHaveBeenNthCalledWith(2, '/auth/passkey-login', { credential: assertion });
      expect(locationHref).toBe('/dashboard');
    });

    it('says so quietly when the browser prompt is closed', async () => {
      apiPost.mockResolvedValue({ data: options });
      getPasskey.mockRejectedValue(new DOMException('closed', 'NotAllowedError'));
      await render();

      await click(buttonNamed('Sign in with a passkey'));

      expect(container.querySelector('#login-error')?.textContent).toBe(
        'The passkey prompt was closed.',
      );
      expect(locationHref).toBe('');
    });

    it('answers the second-factor challenge with a passkey instead of a code', async () => {
      const passkeyOptions = { ...options, userVerification: 'preferred' as const };
      apiPost
        .mockResolvedValueOnce({ data: { twoFactorRequired: true, passkeyOptions } })
        .mockResolvedValueOnce({ data: signedIn });
      getPasskey.mockResolvedValue(assertion);
      await render();
      const form = container.querySelector('form') as HTMLFormElement;
      await act(async () => {
        form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        for (let i = 0; i < 6; i++) await Promise.resolve();
      });
      // The passwordless button gives way to the second-factor one.
      expect(buttonNamed('Sign in with a passkey')).toBeUndefined();

      await click(buttonNamed('Use your passkey'));

      expect(getPasskey).toHaveBeenCalledWith(passkeyOptions);
      expect(apiPost).toHaveBeenLastCalledWith('/auth/login', {
        email: '',
        password: '',
        twoFactorPasskey: assertion,
      });
      expect(locationHref).toBe('/dashboard');
    });

    it('asks for a fresh challenge after a failed passkey answer', async () => {
      const passkeyOptions = { ...options, userVerification: 'preferred' as const };
      const fresh = { ...passkeyOptions, challenge: 'challenge-2' };
      apiPost
        .mockResolvedValueOnce({ data: { twoFactorRequired: true, passkeyOptions } })
        .mockResolvedValueOnce({ data: { twoFactorRequired: true, passkeyOptions: fresh } })
        .mockResolvedValueOnce({ data: signedIn });
      getPasskey
        .mockRejectedValueOnce(new DOMException('closed', 'NotAllowedError'))
        .mockResolvedValueOnce(assertion);
      await render();
      const form = container.querySelector('form') as HTMLFormElement;
      await act(async () => {
        form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        for (let i = 0; i < 6; i++) await Promise.resolve();
      });

      await click(buttonNamed('Use your passkey'));
      await click(buttonNamed('Use your passkey'));

      expect(getPasskey).toHaveBeenNthCalledWith(1, passkeyOptions);
      expect(getPasskey).toHaveBeenNthCalledWith(2, fresh);
      expect(locationHref).toBe('/dashboard');
    });

    it('offers no passkey on the second step to an account without one', async () => {
      apiPost.mockResolvedValueOnce({ data: { twoFactorRequired: true } });
      await render();
      const form = container.querySelector('form') as HTMLFormElement;
      await act(async () => {
        form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        for (let i = 0; i < 6; i++) await Promise.resolve();
      });
      expect(buttonNamed('Use your passkey')).toBeUndefined();
      expect(container.querySelector('input[name="twoFactorCode"]')).toBeTruthy();
    });
  });
});
