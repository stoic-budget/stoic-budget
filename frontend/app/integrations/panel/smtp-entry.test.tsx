// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiResponse } from '@/app/test/api-response';

const apiGet = vi.hoisted(() => vi.fn());
const apiPut = vi.hoisted(() => vi.fn());

vi.mock('@/app/lib/api', () => ({
  default: { get: apiGet, put: apiPut, post: vi.fn(), delete: vi.fn() },
}));

import { ProtocolIntegrationPage } from '../open-protocol-page';
import { findIntegrationEntry, useIntegrationCatalog } from './integration-catalog';

const ACCOUNT_PASSWORD = 'Member-One-password-1';
const disconnected = {
  connected: false,
  status: 'disconnected',
  source: 'disabled',
  settings: { host: null, port: 587, secure: false, from: null, passConfigured: false },
};
const connected = {
  connected: true,
  status: 'connected',
  source: 'workspace',
  settings: {
    host: 'mail.example.com',
    port: 587,
    secure: false,
    from: 'Member One <noreply@example.com>',
    passConfigured: true,
  },
};

function SmtpForm() {
  const entry = findIntegrationEntry(useIntegrationCatalog(), 'smtp');
  if (entry?.detail.kind !== 'protocol') throw new Error('SMTP is a protocol entry');
  return <ProtocolIntegrationPage {...entry.detail.config} embedded />;
}

const field = (label: string) => screen.getByLabelText(label) as HTMLInputElement;
const fill = (label: string, value: string) =>
  fireEvent.change(field(label), { target: { value } });

async function renderForm() {
  render(<SmtpForm />);
  await screen.findByDisplayValue('587');
  fill('Host', 'mail.example.com');
  fill('From', 'Member One <noreply@example.com>');
}

const connect = () =>
  act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Connect' }));
  });

describe('SMTP settings form', () => {
  beforeEach(() => {
    apiGet.mockReset();
    apiPut.mockReset();
    apiGet.mockResolvedValue(apiResponse(disconnected));
  });

  it('asks for the account password, never fills it in, sends it and empties it after a save', async () => {
    apiPut.mockResolvedValue(apiResponse(connected));
    await renderForm();

    const password = field('Your account password');
    expect(password.type).toBe('password');
    expect(password.required).toBe(true);
    expect(password.value).toBe('');

    fill('Your account password', ACCOUNT_PASSWORD);
    await connect();

    expect(apiPut).toHaveBeenCalledWith(
      '/settings/email/smtp',
      expect.objectContaining({ host: 'mail.example.com', currentPassword: ACCOUNT_PASSWORD }),
    );
    expect(field('Your account password').value).toBe('');
  });

  it('says the password is wrong when the server refuses it', async () => {
    apiPut.mockRejectedValue({
      isAxiosError: true,
      response: {
        status: 403,
        data: { error: { code: 'AUTH_CURRENT_PASSWORD_INCORRECT', message: 'refused' } },
      },
    });
    await renderForm();
    fill('Your account password', 'not-the-password');

    await connect();

    expect(await screen.findByText('Current password is incorrect')).toBeTruthy();
  });
});
