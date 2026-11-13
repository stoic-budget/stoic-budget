// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { setPrivacyMode } from '@/app/lib/privacy-mode';
import { AccountMenu } from './AccountMenu';

const push = vi.hoisted(() => vi.fn());
const permissions = vi.hoisted(() => ({ granted: [] as string[] }));

vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
vi.mock('next-themes', () => ({ useTheme: () => ({ setTheme: vi.fn(), resolvedTheme: 'light' }) }));
vi.mock('@/app/hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'u1', name: 'Administrator', avatarUrl: null, themePreference: 'light' },
    logout: vi.fn(),
    setUser: vi.fn(),
  }),
}));
vi.mock('@/app/hooks/usePermissions', () => ({
  usePermissions: () => ({ hasPermission: (permission: string) => permissions.granted.includes(permission) }),
}));
vi.mock('./hooks/useThemePreference', () => ({
  useThemePreference: () => ({ handleThemePreferenceChange: vi.fn() }),
}));
vi.mock('@/app/i18n', () => ({
  useIntlayer: () => ({
    userMenu: new Proxy({}, { get: (_target, name) => String(name) }),
    nav: new Proxy({}, { get: (_target, name) => String(name) }),
    newBadge: { value: 'newBadge' },
  }),
}));
const whatsNew = vi.hoisted(() => ({ unseen: false }));
vi.mock('@/app/components/whats-new/useWhatsNew', () => ({
  useWhatsNew: () => ({ latest: null, unseen: whatsNew.unseen }),
}));

afterEach(() => {
  act(() => setPrivacyMode(false));
  permissions.granted = [];
  push.mockReset();
  whatsNew.unseen = false;
});

describe('AccountMenu', () => {
  it('switches privacy mode from the row under the theme, and stays open', () => {
    render(<AccountMenu variant="mobile" />);
    fireEvent.click(screen.getByRole('button', { name: /Administrator/ }));

    const row = screen.getByRole('menuitem', { name: /privacyMode/ });
    expect(row.querySelector('input[type="checkbox"]')).not.toBeChecked();

    fireEvent.click(row);

    expect(document.documentElement.dataset.privacy).toBe('on');
    expect(screen.getByRole('menuitem', { name: /privacyMode/ }).querySelector('input')).toBeChecked();
    // The row before it is the theme switch.
    const items = screen.getAllByRole('menuitem').map(item => item.textContent);
    expect(items.indexOf('privacyMode')).toBe(items.indexOf('darkMode') + 1);
  });

  it('keeps the amounts hidden when the reader declines to show them', () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    act(() => setPrivacyMode(true));
    render(<AccountMenu variant="mobile" />);
    fireEvent.click(screen.getByRole('button', { name: /Administrator/ }));

    fireEvent.click(screen.getByRole('menuitem', { name: /privacyMode/ }));

    expect(confirm).toHaveBeenCalledOnce();
    expect(document.documentElement.dataset.privacy).toBe('on');
    confirm.mockRestore();
  });

  it('opens the admin page for whoever may read the audit log, in place of what was new', () => {
    permissions.granted = ['audit_log.view'];
    render(<AccountMenu />);
    fireEvent.click(screen.getByRole('button', { name: /Administrator/ }));

    const items = screen.getAllByRole('menuitem').map(item => item.textContent);
    expect(items).not.toContain('whatsNew');
    expect(items.indexOf('admin')).toBe(items.indexOf('settings') - 1);

    fireEvent.click(screen.getByRole('menuitem', { name: 'admin' }));
    expect(push).toHaveBeenCalledWith('/admin');
  });

  it('leaves the admin page out for anyone else', () => {
    render(<AccountMenu />);
    fireEvent.click(screen.getByRole('button', { name: /Administrator/ }));

    expect(screen.queryByRole('menuitem', { name: 'admin' })).toBeNull();
  });

  it('opens Settings as before while nothing is new, with no dot', () => {
    render(<AccountMenu />);
    expect(screen.queryByRole('img', { name: 'newBadge' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Administrator/ }));

    fireEvent.click(screen.getByRole('menuitem', { name: 'settings' }));

    expect(push).toHaveBeenCalledWith('/settings/profile');
  });

  it('dots the avatar and Settings for a new release, and Settings leads to the changelog', () => {
    whatsNew.unseen = true;
    render(<AccountMenu />);
    expect(screen.getByRole('img', { name: 'newBadge' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Administrator/ }));

    const settings = screen.getByRole('menuitem', { name: /settings/ });
    expect(settings.querySelector('[role="img"][aria-label="newBadge"]')).not.toBeNull();
    // What's new stays out of the menu: the changelog lives in Settings.
    expect(screen.getAllByRole('menuitem').map(item => item.textContent)).not.toContain('whatsNew');
    fireEvent.click(settings);

    expect(push).toHaveBeenCalledWith('/settings/profile?tab=advanced&section=changelog');
  });
});
