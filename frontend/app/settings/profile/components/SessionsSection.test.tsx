// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { UserSession } from '@/app/settings/profile/profileHelpers';

vi.mock('@/app/components/ui/EmptyStateIllustration', () => ({ EmptyStateIllustration: () => null }));
vi.mock('@/app/components/ui/snapshot-skeleton/SnapshotSkeleton', () => ({
  SnapshotSkeleton: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
}));

import { SessionsSection, sessionsShown } from './SessionsSection';

const session = (n: number, isCurrent = false): UserSession => ({
  id: `session-${n}`,
  device: `Device ${n}`,
  browser: 'Browser',
  os: 'OS',
  ipAddress: null,
  createdAt: '2026-11-01T10:00:00.000Z',
  lastUsedAt: '2026-11-01T10:00:00.000Z',
  isCurrent,
});
const many = (count: number, currentAt = -1) =>
  Array.from({ length: count }, (_, n) => session(n, n === currentAt));

describe('sessionsShown', () => {
  it('keeps a short list whole', () => {
    expect(sessionsShown(many(3), false)).toHaveLength(3);
  });

  it('shows the five most recent, the current one always among them', () => {
    const sessions = many(40, 30);
    const shown = sessionsShown(sessions, false);

    expect(shown).toHaveLength(5);
    expect(shown[0].isCurrent).toBe(true);
    expect(shown.slice(1).map(s => s.id)).toEqual(sessions.slice(0, 4).map(s => s.id));
  });

  it('shows them all once asked', () => {
    expect(sessionsShown(many(40), true)).toHaveLength(40);
  });
});

describe('SessionsSection', () => {
  it('draws five cards and a "Show all" that brings the rest', () => {
    const sessions = many(12, 0);
    render(
      <SessionsSection
        t={{ sessionsCard: { lastLoginLabel: { value: 'Last login' }, logoutAllButton: { value: 'Log out all' } } }}
        tx={path => (path.at(-1) === 'showAll' ? 'Show all ({{count}})' : path.join('.'))}
        sessionsMessage={null}
        sessionsError={null}
        sessionsLoading={false}
        sessions={sessions}
        userLastLogin={null}
        logoutSessionLoadingId={null}
        handleLogoutSession={vi.fn()}
        handleLogoutAll={vi.fn()}
        formatPreferences={{ locale: 'en', timeZone: 'UTC', dateFormat: null, firstDayOfWeek: null } as never}
      />,
    );

    expect(screen.getAllByText(/^Device \d+ · Browser$/)).toHaveLength(5);
    fireEvent.click(screen.getByText(`Show all (${sessions.length})`));
    expect(screen.getAllByText(/^Device \d+ · Browser$/)).toHaveLength(sessions.length);
    expect(screen.queryByText(/^Show all/)).toBeNull();
  });
});
