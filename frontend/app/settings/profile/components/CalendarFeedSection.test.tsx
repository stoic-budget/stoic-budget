// @vitest-environment jsdom
import { fireEvent, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CalendarFeedSettings } from '@/app/lib/contracts';
import { renderWithQuery } from '@/app/test/query-wrapper';

const hook = vi.hoisted(() => ({
  state: {} as Record<string, unknown>,
}));

vi.mock('@/app/settings/profile/hooks/useCalendarFeed', async importOriginal => ({
  ...(await importOriginal<typeof import('@/app/settings/profile/hooks/useCalendarFeed')>()),
  useCalendarFeed: () => hook.state,
}));

import { calendarFeedUrl } from '@/app/settings/profile/hooks/useCalendarFeed';
import { CalendarFeedSection } from './CalendarFeedSection';

const TOKEN = 'feedTokenForMemberOne_0123456789ab';

const settings = (overrides: Partial<CalendarFeedSettings> = {}): CalendarFeedSettings => ({
  enabled: true,
  include: { payables: true, subscriptions: true, taxDeadlines: false, invoices: true },
  createdAt: '2026-11-01T08:00:00.000Z',
  lastFetchedAt: null,
  ...overrides,
});

const mutation = (data?: unknown) => ({ mutate: vi.fn(), isPending: false, data });
const mutate = (name: string) => (hook.state[name] as { mutate: ReturnType<typeof vi.fn> }).mutate;

const setHook = (data: CalendarFeedSettings | undefined, issued?: { token: string }) => {
  hook.state = {
    query: { data },
    issue: mutation(issued),
    update: mutation(),
    remove: mutation(),
  };
};

describe('CalendarFeedSection', () => {
  beforeEach(() => {
    setHook(settings());
    vi.spyOn(window, 'confirm').mockReturnValue(true);
  });

  it('offers to turn the feed on while it is off', () => {
    setHook(settings({ enabled: false }));
    renderWithQuery(<CalendarFeedSection />);
    fireEvent.click(screen.getByRole('button', { name: 'Turn on' }));
    expect(mutate('issue')).toHaveBeenCalled();
    // Turning on asks nothing: there is no old link to revoke.
    expect(window.confirm).not.toHaveBeenCalled();
    expect(screen.queryByRole('switch')).toBeNull();
  });

  it('shows the link with a copy button only right after it was made', async () => {
    const writeText = vi.fn(async () => undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    setHook(settings(), { token: TOKEN });
    renderWithQuery(<CalendarFeedSection />);
    const url = calendarFeedUrl(TOKEN);
    expect(screen.getByLabelText('Calendar link')).toHaveValue(url);
    expect(url).toBe(`${window.location.origin}/api/v1/public/calendar/${TOKEN}.ics`);
    fireEvent.click(screen.getByRole('button', { name: 'Copy link' }));
    await vi.waitFor(() => expect(writeText).toHaveBeenCalledWith(url));
  });

  it('says the link was shown once when it is not in hand', () => {
    renderWithQuery(<CalendarFeedSection />);
    expect(screen.queryByLabelText('Calendar link')).toBeNull();
    expect(screen.getByText(/shown once, when it was made/)).toBeInTheDocument();
    expect(screen.getByText('No calendar app has read it yet.')).toBeInTheDocument();
  });

  it('switches one kind at a time', () => {
    renderWithQuery(<CalendarFeedSection />);
    const tax = screen.getByRole('switch', { name: 'Tax deadlines' });
    expect(tax).not.toBeChecked();
    expect(screen.getByRole('switch', { name: 'Subscription charges' })).toBeChecked();
    fireEvent.click(tax);
    expect(mutate('update')).toHaveBeenCalledWith({ taxDeadlines: true }, expect.anything());
  });

  it('asks before a new link revokes the old one, and before turning off', () => {
    vi.mocked(window.confirm).mockReturnValueOnce(false);
    renderWithQuery(<CalendarFeedSection />);
    fireEvent.click(screen.getByRole('button', { name: 'New link' }));
    expect(mutate('issue')).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'New link' }));
    expect(mutate('issue')).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Turn off' }));
    expect(window.confirm).toHaveBeenCalledTimes(3);
    expect(mutate('remove')).toHaveBeenCalled();
  });
});
