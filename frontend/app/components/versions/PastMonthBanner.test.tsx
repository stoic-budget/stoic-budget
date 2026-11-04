// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { currentMonthKey } from '@/app/components/dashboard/month-end';
import { PastMonthBanner } from './PastMonthBanner';

const nav = vi.hoisted(() => ({
  pathname: '/budgets',
  params: new URLSearchParams(),
  push: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  usePathname: () => nav.pathname,
  useSearchParams: () => nav.params,
  useRouter: () => ({ push: nav.push }),
}));
vi.mock('@/app/i18n', () => ({
  useLocale: () => ({ locale: 'en' }),
  useIntlayer: () => ({
    viewing: { value: 'You are viewing {{month}}' },
    notCurrent: 'not current data',
    back: 'Back',
  }),
}));

describe('PastMonthBanner', () => {
  beforeEach(() => {
    nav.pathname = '/budgets';
    nav.push.mockReset();
  });

  it('names the past month and goes back to the dashboard on it', () => {
    nav.params = new URLSearchParams('month=2020-10&asOf=2020-10');
    render(<PastMonthBanner />);

    expect(screen.getByRole('status')).toHaveTextContent(
      'You are viewing October 2020 · not current data',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(nav.push).toHaveBeenCalledWith('/dashboard?month=2020-10');
  });

  it('stays away without a past month, and on the dashboard itself', () => {
    nav.params = new URLSearchParams(`asOf=${currentMonthKey()}`);
    const { rerender } = render(<PastMonthBanner />);
    expect(screen.queryByRole('status')).toBeNull();

    nav.params = new URLSearchParams('asOf=2020-10');
    nav.pathname = '/dashboard';
    rerender(<PastMonthBanner />);
    expect(screen.queryByRole('status')).toBeNull();
  });
});
