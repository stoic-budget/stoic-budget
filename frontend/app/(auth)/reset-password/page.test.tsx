// @vitest-environment jsdom
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Passkey } from '@/app/lib/contracts';
import { apiResponse } from '@/app/test/api-response';
import { renderWithQuery } from '@/app/test/query-wrapper';

const apiPost = vi.hoisted(() => vi.fn());
const TOKEN = 'a'.repeat(64);

vi.mock('@/app/lib/api', () => ({ __esModule: true, default: { post: apiPost } }));
vi.mock('next/navigation', () => ({
  useSearchParams: () => ({ get: (key: string) => (key === 'token' ? TOKEN : null) }),
}));
vi.mock('@/app/components/AuthLanguageSwitcher', () => ({
  AuthLanguageSwitcher: () => null,
}));

import ResetPasswordPage from './page';

const passkey = (overrides: Partial<Passkey>): Passkey => ({
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Work laptop',
  deviceType: 'multiDevice',
  backedUp: true,
  createdAt: '2026-10-01T09:00:00.000Z',
  lastUsedAt: null,
  ...overrides,
});
const laptop = passkey({});
const key = passkey({
  id: '22222222-2222-4222-8222-222222222222',
  name: 'Desk key',
  deviceType: 'singleDevice',
  backedUp: false,
  lastUsedAt: '2026-11-01T09:00:00.000Z',
});

const answer = (passkeys: Passkey[]) =>
  apiPost.mockImplementation(async (url: string) =>
    url === '/auth/reset-password/passkeys' ? apiResponse(passkeys) : apiResponse({ message: 'ok' }),
  );

const fillPassword = () => {
  for (const id of ['password', 'confirmPassword']) {
    fireEvent.change(document.getElementById(id) as HTMLInputElement, {
      target: { value: 'Fresh-Pass-2026' },
    });
  }
};
const submit = () => fireEvent.click(screen.getByRole('button', { name: 'Update password' }));
const resetBody = () =>
  apiPost.mock.calls.find(([url]) => url === '/auth/reset-password')?.[1] as Record<string, unknown>;

describe('ResetPasswordPage passkeys', () => {
  beforeEach(() => apiPost.mockReset());

  it("lists the link's passkeys with the token, removal unticked", async () => {
    answer([laptop, key]);
    renderWithQuery(<ResetPasswordPage />);

    expect(await screen.findByText('Work laptop')).toBeInTheDocument();
    expect(screen.getByText('Desk key')).toBeInTheDocument();
    expect(screen.getByText(/Synced/)).toBeInTheDocument();
    expect(screen.getByText(/This device only/)).toBeInTheDocument();
    expect(apiPost).toHaveBeenCalledWith('/auth/reset-password/passkeys', { token: TOKEN });
    expect(screen.getByLabelText('Also remove these passkeys')).not.toBeChecked();
  });

  it('keeps every passkey when the box stays unticked', async () => {
    answer([laptop, key]);
    renderWithQuery(<ResetPasswordPage />);
    await screen.findByText('Work laptop');

    fillPassword();
    submit();

    await waitFor(() => expect(resetBody()).toBeDefined());
    expect(resetBody()).toEqual({ token: TOKEN, newPassword: 'Fresh-Pass-2026' });
  });

  it('sends exactly the listed passkeys when the box is ticked', async () => {
    answer([laptop, key]);
    renderWithQuery(<ResetPasswordPage />);
    await screen.findByText('Work laptop');

    fireEvent.click(screen.getByLabelText('Also remove these passkeys'));
    fillPassword();
    submit();

    await waitFor(() => expect(resetBody()).toBeDefined());
    expect(resetBody()).toEqual({
      token: TOKEN,
      newPassword: 'Fresh-Pass-2026',
      removePasskeyIds: [laptop.id, key.id],
    });
  });

  it('shows no list for an account without passkeys or a refused link', async () => {
    apiPost.mockImplementation(async (url: string) => {
      if (url === '/auth/reset-password/passkeys') throw new Error('400');
      return apiResponse({ message: 'ok' });
    });
    renderWithQuery(<ResetPasswordPage />);

    await waitFor(() =>
      expect(apiPost).toHaveBeenCalledWith('/auth/reset-password/passkeys', { token: TOKEN }),
    );
    expect(screen.queryByTestId('passkey-review')).toBeNull();
    fillPassword();
    submit();
    await waitFor(() => expect(resetBody()).toEqual({ token: TOKEN, newPassword: 'Fresh-Pass-2026' }));
  });
});
