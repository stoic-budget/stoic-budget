// @vitest-environment jsdom
import { act, fireEvent, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChangelogEntry } from '@/app/components/ChangelogModal';
import {
  closeWelcomeTutorial,
  openWelcome,
} from '@/app/components/welcome-tutorial/welcome-tutorial-store';
import type { User } from '@/app/contexts/AuthContext';
import { renderWithQuery } from '@/app/test/query-wrapper';
import { WHATS_NEW_AUTO_OPEN_DELAY_MS } from './useWhatsNewAutoOpen';
import { WhatsNewHost } from './WhatsNewHost';
import { resetWhatsNewStoreForTests } from './whats-new-store';

const latest: ChangelogEntry = {
  id: 'changelog-2026-11-01-abc1234',
  date: '2026-11-01T10:00:00.000Z',
  title: 'Release update - November 1, 2026',
  summary: 'This release includes 1 feature.',
  markdown: '## Features\n- **reports**: ACME export',
};

const mocks = vi.hoisted(() => ({
  pathname: '/dashboard',
  covered: false,
  fetchLatest: vi.fn(),
  post: vi.fn(),
}));

// The signed-in user, held like AuthContext holds it: setUser re-renders the readers.
const auth = vi.hoisted(() => {
  let user: User | null = null;
  const listeners = new Set<() => void>();
  return {
    get: () => user,
    set: (next: User | null | ((current: User | null) => User | null)) => {
      user = typeof next === 'function' ? next(user) : next;
      for (const listener of listeners) listener();
    },
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
});

vi.mock('next/navigation', () => ({ usePathname: () => mocks.pathname }));
vi.mock('@/app/hooks/useAuth', async () => {
  const { useSyncExternalStore } = await import('react');
  return {
    useAuth: () => ({
      user: useSyncExternalStore(auth.subscribe, auth.get),
      loading: false,
      setUser: auth.set,
    }),
  };
});
vi.mock('@/app/lib/changelog-api', () => ({
  fetchLatestChangelogEntry: mocks.fetchLatest,
  postChangelogSeen: mocks.post,
}));
vi.mock('@/app/components/page-hints/page-hints-dom', () => ({
  isPageCovered: () => mocks.covered,
}));
vi.mock('@/app/i18n', () => ({
  useIntlayer: () => ({ title: { value: "What's new" }, close: { value: 'Close' } }),
}));
// The modal itself is lazy and renders markdown; a stand-in shows which entry is open.
vi.mock('next/dynamic', () => ({
  default: () =>
    function ModalStandIn(props: { entry: ChangelogEntry; onClose: () => void }) {
      return (
        <div role="dialog" aria-label={props.entry.title}>
          <button type="button" onClick={props.onClose}>
            Close
          </button>
        </div>
      );
    },
}));

const pastFirstRun: User = {
  id: 'user-1',
  email: 'member-1@example.com',
  name: 'Member One',
  role: 'user',
  onboardingCompletedAt: '2026-09-01T10:00:00.000Z',
  welcomeTutorialSeenAt: '2026-09-01T10:05:00.000Z',
  pageHintsSeen: { dashboard: 99, budgets: 99 },
  // An account from before the marker: it has seen no entry yet.
  changelogSeenId: null,
  changelogSeenAt: null,
};

const dialog = (): HTMLElement | null => screen.queryByRole('dialog', { name: latest.title });

async function wait(ms: number): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

async function renderHost() {
  const view = renderWithQuery(<WhatsNewHost />);
  await wait(WHATS_NEW_AUTO_OPEN_DELAY_MS + 100);
  return view;
}

describe('WhatsNewHost', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetWhatsNewStoreForTests();
    mocks.pathname = '/dashboard';
    mocks.covered = false;
    mocks.fetchLatest.mockReset().mockResolvedValue(latest);
    mocks.post
      .mockReset()
      .mockResolvedValue({ changelogSeenId: latest.id, changelogSeenAt: latest.date });
    auth.set(pastFirstRun);
  });

  afterEach(() => {
    act(() => closeWelcomeTutorial());
    vi.useRealTimers();
  });

  it('opens the newest release by itself after the page has painted, and marks it seen', async () => {
    renderWithQuery(<WhatsNewHost />);
    await wait(WHATS_NEW_AUTO_OPEN_DELAY_MS - 200);
    expect(dialog()).toBeNull();

    await wait(300);

    expect(dialog()).toBeInTheDocument();
    expect(mocks.post).toHaveBeenCalledOnce();
    expect(mocks.post).toHaveBeenCalledWith(latest);
    expect(auth.get()?.changelogSeenId).toBe(latest.id);
  });

  it('opens once: closed, it does not come back on this page load or the next', async () => {
    const view = await renderHost();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    });
    expect(dialog()).toBeNull();

    view.unmount();
    // A new page load: a fresh store, the user as the server now has them.
    resetWhatsNewStoreForTests();
    await renderHost();

    expect(dialog()).toBeNull();
    expect(mocks.post).toHaveBeenCalledOnce();
  });

  it('stays closed on another device once the release was seen', async () => {
    auth.set({ ...pastFirstRun, changelogSeenId: latest.id, changelogSeenAt: latest.date });
    await renderHost();
    expect(dialog()).toBeNull();
    expect(mocks.post).not.toHaveBeenCalled();
  });

  it('stays closed for a new account, which starts after the release', async () => {
    auth.set({ ...pastFirstRun, changelogSeenAt: '2026-11-05T09:00:00.000Z' });
    await renderHost();
    expect(dialog()).toBeNull();
  });

  it('waits until onboarding is done', async () => {
    auth.set({ ...pastFirstRun, onboardingCompletedAt: null });
    await renderHost();
    expect(dialog()).toBeNull();
  });

  it('stays off the onboarding and invitation pages', async () => {
    mocks.pathname = '/onboarding';
    await renderHost();
    expect(dialog()).toBeNull();
  });

  it('waits until the welcome window was closed', async () => {
    auth.set({ ...pastFirstRun, welcomeTutorialSeenAt: null });
    await renderHost();
    expect(dialog()).toBeNull();
  });

  it('never opens over the welcome window or the guide', async () => {
    act(() => openWelcome());
    await renderHost();
    expect(dialog()).toBeNull();
  });

  it('leaves a page whose guide page is about to open to the guide', async () => {
    auth.set({ ...pastFirstRun, pageHintsSeen: { budgets: 99 } });
    await renderHost();
    expect(dialog()).toBeNull();
  });

  it('never counts a user object without the marker as not seen', async () => {
    const { changelogSeenId: _id, changelogSeenAt: _at, ...withoutMarker } = pastFirstRun;
    auth.set(withoutMarker);
    await renderHost();
    expect(dialog()).toBeNull();
  });

  it('does not open over another window, and tries again on the next page', async () => {
    mocks.covered = true;
    await renderHost();
    expect(dialog()).toBeNull();

    mocks.covered = false;
    mocks.pathname = '/budgets';
    // The navigation re-renders the host.
    act(() => auth.set(current => (current ? { ...current } : current)));
    await wait(WHATS_NEW_AUTO_OPEN_DELAY_MS + 100);

    expect(dialog()).toBeInTheDocument();
  });
});
