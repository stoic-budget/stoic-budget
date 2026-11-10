// @vitest-environment jsdom
import { fireEvent, screen, waitFor } from '@testing-library/react';
import * as Schema from 'effect/Schema';
import { describe, expect, it, vi } from 'vitest';
import { type Passkey, PasskeyRenameBody } from '@/app/lib/contracts';
import type { UsePasskeysReturn } from '@/app/settings/profile/hooks/usePasskeys';
import { renderWithQuery } from '@/app/test/query-wrapper';
import { isValidPasskeyName } from './PasskeyRow';
import { PasskeysSection } from './PasskeysSection';

const passkey = (overrides: Partial<Passkey> = {}): Passkey => ({
  id: 'passkey-1',
  name: 'Work laptop',
  deviceType: 'multiDevice',
  backedUp: true,
  createdAt: '2026-10-01T09:00:00.000Z',
  lastUsedAt: null,
  ...overrides,
});

const hook = (overrides: Partial<UsePasskeysReturn> = {}): UsePasskeysReturn => ({
  passkeys: [passkey()],
  loading: false,
  loadFailed: false,
  supported: true,
  busy: false,
  message: null,
  error: null,
  add: vi.fn(async () => true),
  rename: vi.fn(async () => true),
  remove: vi.fn(async () => true),
  ...overrides,
});

const render = (passkeys: UsePasskeysReturn) =>
  renderWithQuery(
    <PasskeysSection tx={path => path.join('.')} passkeys={passkeys} formatPreferences={{}} />,
  );

describe('PasskeysSection', () => {
  it('accepts exactly the names the server accepts', () => {
    const accepts = (name: string) =>
      Schema.is(PasskeyRenameBody)({ name }) && name.trim().length > 0;
    for (const name of ['', '   ', 'a', ' Phone ', 'x'.repeat(60), 'x'.repeat(61), 'é'.repeat(60)]) {
      expect(isValidPasskeyName(name)).toBe(accepts(name));
    }
  });

  it('lists each passkey with its kind and when it was last used', () => {
    render(hook());
    expect(screen.getByText('Work laptop')).toBeInTheDocument();
    expect(screen.getByText(/Synced/)).toBeInTheDocument();
    expect(screen.getByText(/Not used yet/)).toBeInTheDocument();
  });

  it('says when there are none, and that the browser cannot make one', () => {
    render(hook({ passkeys: [], supported: false }));
    expect(screen.getByText('No passkeys yet.')).toBeInTheDocument();
    expect(screen.getByText('This browser cannot use passkeys.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add a passkey' })).toBeNull();
  });

  it('adds a passkey only with a name and the password', async () => {
    const passkeys = hook({ passkeys: [] });
    render(passkeys);
    const add = screen.getByRole('button', { name: 'Add a passkey' });
    expect(add).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/Name/), { target: { value: 'Phone' } });
    expect(add).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/passwordCard.currentPasswordLabel/), {
      target: { value: 'secret' },
    });
    fireEvent.click(add);
    await waitFor(() =>
      expect(passkeys.add).toHaveBeenCalledWith({ name: 'Phone', password: 'secret' }),
    );
  });

  // Without the add form, so the row's own fields are the only ones on screen.
  it('renames in place and refuses a blank name', async () => {
    const passkeys = hook({ supported: false });
    render(passkeys);
    fireEvent.click(screen.getByRole('button', { name: 'Rename' }));
    const field = screen.getByLabelText(/Name/);
    fireEvent.change(field, { target: { value: '   ' } });
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    fireEvent.change(field, { target: { value: 'Phone' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(passkeys.rename).toHaveBeenCalledWith({ id: 'passkey-1', name: 'Phone' }));
  });

  it('removes a passkey only after the password', async () => {
    const passkeys = hook({ supported: false });
    render(passkeys);
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    fireEvent.change(screen.getByLabelText(/passwordCard.currentPasswordLabel/), {
      target: { value: 'secret' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    await waitFor(() => expect(passkeys.remove).toHaveBeenCalledWith({ id: 'passkey-1', password: 'secret' }));
  });
});
