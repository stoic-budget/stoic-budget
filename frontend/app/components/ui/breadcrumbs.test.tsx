import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_APP_ROUTE } from '@/app/lib/default-app-route';
import { Breadcrumbs } from './breadcrumbs';

vi.mock('@/app/i18n', () => ({
  useIntlayer: () => ({
    nav: { accounts: 'Accounts' },
    breadcrumbs: { home: 'Home', label: { value: 'Breadcrumb' } },
  }),
}));

describe('Breadcrumbs', () => {
  it('leads from Home through the sidebar page to the page inside it', () => {
    const account = 'Everyday Card';
    render(<Breadcrumbs parent="/accounts" current={account} />);

    const crumbs = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(crumbs.textContent).toBe(`Home/Accounts/${account}`);
    expect(screen.getByRole('link', { name: 'Home' }).getAttribute('href')).toBe(DEFAULT_APP_ROUTE);
    expect(screen.getByRole('link', { name: 'Accounts' }).getAttribute('href')).toBe('/accounts');
    expect(screen.getByText(account).getAttribute('aria-current')).toBe('page');
  });

  it('keeps the trail while the page itself is still loading', () => {
    render(<Breadcrumbs parent="/accounts" current={null} />);

    expect(screen.getByRole('link', { name: 'Accounts' })).toBeInTheDocument();
  });
});
