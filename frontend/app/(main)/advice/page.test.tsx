// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Insight } from '@/app/hooks/useInsights';
import AdvicePage from './page';

const insight = (overrides: Partial<Insight>): Insight => ({
  id: 'i',
  type: 'stoic.plan',
  category: 'stoic',
  severity: 'info',
  title: 'Title',
  message: 'Message',
  messageKey: null,
  messageParams: null,
  data: null,
  createdAt: new Date(Date.now() - 2 * 86_400_000).toISOString(),
  ...overrides,
});

const dismiss = vi.fn();
const items = [
  insight({
    id: 'savings',
    type: 'trend.savings_rate',
    messageKey: 'trend.savings_rate_up',
    title: 'Savings rate is up',
  }),
  insight({ id: 'unused', data: { priority: 20 }, title: 'A budget has gone unused' }),
  insight({ id: 'shortfall', data: { priority: 100 }, title: 'The balance goes below zero' }),
  insight({ id: 'goal', type: 'stoic.goal', data: { priority: 85 }, title: 'A goal does not fit' }),
  insight({
    id: 'risk',
    type: 'pattern.risky_allocation',
    severity: 'warn',
    title: 'Too much depends on fortune',
  }),
  insight({
    id: 'keep',
    type: 'stoic.reflection',
    data: { author: 'Seneca', work: 'Moral Letters to Lucilius, Letter 1' },
    title: 'Keep your part first',
  }),
  insight({ id: 'past', data: { month: '2026-01' }, title: 'About a past month' }),
];

const refresh = vi.hoisted(() => ({ mutate: vi.fn(), workspaceId: 'ws-1' as string | null }));

vi.mock('@/app/hooks/useInsights', () => ({
  useInsights: () => ({ items, isPending: false, dismiss }),
  useRefreshInsights: () => ({ mutate: refresh.mutate }),
}));
vi.mock('@/app/hooks/useWorkspaceId', () => ({ useWorkspaceId: () => refresh.workspaceId }));
vi.mock('@/app/components/insights/insight-href', () => ({ insightHref: () => '/somewhere' }));
// The heading reads the whole sidebar config; it has tests of its own.
vi.mock('@/app/components/ui/page-title', () => ({ PageTitle: () => null }));
// Every dictionary entry renders as its own key.
vi.mock('@/app/i18n', () => ({
  useIntlayer: () =>
    new Proxy({}, { get: (_, key: string) => ({ value: key, toString: () => key }) }),
  useLocale: () => ({ locale: 'en' }),
}));

describe('AdvicePage', () => {
  it('asks for attention by importance, whatever the kind of advice', () => {
    const { container } = render(<AdvicePage />);

    const [attention, info] = screen.getAllByRole('heading').map(heading => heading.parentElement);
    expect(screen.getAllByRole('heading').map(heading => heading.textContent)).toEqual([
      'needsAttention',
      'forYourInfo',
    ]);
    const titles = (group: HTMLElement | null | undefined) =>
      within(group as HTMLElement)
        .getAllByRole('listitem')
        .map(row => row.querySelector('.MuiTypography-root')?.textContent);
    expect(titles(attention)).toEqual([
      'The balance goes below zero',
      'A goal does not fit',
      'Too much depends on fortune',
    ]);
    expect(titles(info)).toEqual(
      expect.arrayContaining(['A budget has gone unused', 'Savings rate is up']),
    );
    expect(container.querySelectorAll('.seneca-advice__dot')).toHaveLength(3);
  });

  it('credits a reflection with its Stoic source', () => {
    render(<AdvicePage />);
    expect(screen.getByText('— Seneca, Moral Letters to Lucilius, Letter 1')).toBeTruthy();
  });

  it('says which month it judged when it is not the running one', () => {
    render(<AdvicePage />);
    const row = screen.getByText('About a past month').closest('li') as HTMLElement;
    expect(within(row).getByText(/January 2026 · 2 days ago/)).toBeTruthy();
    const current = screen.getByText('A budget has gone unused').closest('li') as HTMLElement;
    expect(within(current).getByText('2 days ago')).toBeTruthy();
  });

  it('recomputes on open, but only once the workspace is known', () => {
    refresh.mutate.mockReset();
    refresh.workspaceId = null;
    const { rerender } = render(<AdvicePage />);
    // Without a workspace the server answers 403 (a fresh browser's first load).
    expect(refresh.mutate).not.toHaveBeenCalled();

    refresh.workspaceId = 'ws-1';
    rerender(<AdvicePage />);
    expect(refresh.mutate).toHaveBeenCalledWith('en');
  });

  it('lets a line be dismissed', () => {
    render(<AdvicePage />);

    fireEvent.click(screen.getByRole('button', { name: 'dismiss: A goal does not fit' }));
    expect(dismiss).toHaveBeenCalledWith('goal');
  });
});
