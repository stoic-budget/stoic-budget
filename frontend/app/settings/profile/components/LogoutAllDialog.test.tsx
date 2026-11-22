// @vitest-environment jsdom
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { AxiosError, AxiosHeaders } from 'axios';
import { describe, expect, it, vi } from 'vitest';
import type { Passkey } from '@/app/lib/contracts';
import { renderWithQuery } from '@/app/test/query-wrapper';
import { LogoutAllDialog } from './LogoutAllDialog';

const laptop: Passkey = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Work laptop',
  deviceType: 'multiDevice',
  backedUp: true,
  createdAt: '2026-10-01T09:00:00.000Z',
  lastUsedAt: null,
};
const key: Passkey = {
  ...laptop,
  id: '22222222-2222-4222-8222-222222222222',
  name: 'Desk key',
  deviceType: 'singleDevice',
};

const setup = (removing = vi.fn(async () => undefined)) => {
  const plain = vi.fn(async () => undefined);
  renderWithQuery(
    <LogoutAllDialog
      passkeys={[laptop, key]}
      tx={path => path.join('.')}
      onClose={vi.fn()}
      onLogoutAll={plain}
      onLogoutAllRemoving={removing}
    />,
  );
  const confirm = () => screen.getByRole('button', { name: 'sessionsCard.logoutAllButton' });
  return { plain, removing, confirm };
};

describe('LogoutAllDialog', () => {
  it('lists the passkeys and logs out as before when nothing is chosen', async () => {
    const { plain, removing, confirm } = setup();

    expect(screen.getByText('Work laptop')).toBeInTheDocument();
    expect(screen.getByText('Desk key')).toBeInTheDocument();
    expect(screen.getByLabelText('Also remove these passkeys')).not.toBeChecked();
    // No password asked for while nothing is removed.
    expect(screen.queryByLabelText(/passwordCard.currentPasswordLabel/)).toBeNull();

    fireEvent.click(confirm());
    await waitFor(() => expect(plain).toHaveBeenCalledTimes(1));
    expect(removing).not.toHaveBeenCalled();
  });

  it('removes exactly the listed passkeys once the password is typed', async () => {
    const { plain, removing, confirm } = setup();

    fireEvent.click(screen.getByLabelText('Also remove these passkeys'));
    expect(confirm()).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/passwordCard.currentPasswordLabel/), {
      target: { value: 'secret' },
    });
    fireEvent.click(confirm());

    await waitFor(() => expect(removing).toHaveBeenCalledWith([laptop.id, key.id], 'secret'));
    expect(plain).not.toHaveBeenCalled();
  });

  it('stays open with the reason when the password is refused', async () => {
    const refusal = new AxiosError('Forbidden', '403', undefined, undefined, {
      status: 403,
      statusText: 'Forbidden',
      headers: {},
      config: { headers: new AxiosHeaders() },
      data: { error: { code: 'AUTH_CURRENT_PASSWORD_INCORRECT', message: 'Wrong password' } },
    });
    const { plain, confirm } = setup(vi.fn(async () => Promise.reject(refusal)));

    fireEvent.click(screen.getByLabelText('Also remove these passkeys'));
    fireEvent.change(screen.getByLabelText(/passwordCard.currentPasswordLabel/), {
      target: { value: 'wrong' },
    });
    fireEvent.click(confirm());

    expect(await screen.findByText('Wrong password')).toBeInTheDocument();
    expect(screen.getByText('Work laptop')).toBeInTheDocument();
    expect(confirm()).not.toBeDisabled();
    expect(plain).not.toHaveBeenCalled();
  });
});
