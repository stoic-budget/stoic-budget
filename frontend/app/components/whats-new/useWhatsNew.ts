'use client';

import { useQuery } from '@tanstack/react-query';
import { useCallback } from 'react';
import type { ChangelogEntry } from '@/app/components/ChangelogModal';
import type { User } from '@/app/contexts/AuthContext';
import { useAuth } from '@/app/hooks/useAuth';
import { fetchLatestChangelogEntry, postChangelogSeen } from '@/app/lib/changelog-api';
import { isChangelogEntryUnseen, laterMarker } from '@/app/lib/changelog-seen';
import { queryKeys } from '@/app/lib/query-keys';

const withMarker =
  (marker: { changelogSeenId: string | null; changelogSeenAt: string | null }) =>
  (current: User | null): User | null =>
    current ? { ...current, ...laterMarker(current, marker) } : current;

/**
 * Records `entry` as seen. The local user moves first, so the badge goes at once;
 * the server's marker is merged in when it arrives and never moves it back. An
 * entry the user has already passed sends nothing.
 */
export function useMarkChangelogSeen(): (entry: ChangelogEntry) => void {
  const { user, setUser } = useAuth();

  return useCallback(
    (entry: ChangelogEntry) => {
      if (!(user && isChangelogEntryUnseen(entry, user))) {
        return;
      }
      setUser(withMarker({ changelogSeenId: entry.id, changelogSeenAt: entry.date }));
      postChangelogSeen(entry)
        .then(marker => setUser(withMarker(marker)))
        // Nothing to recover: without the server's record the entry shows once more
        // in the next session.
        .catch(() => undefined);
    },
    [user, setUser],
  );
}

/** The newest release, read once per session for a signed-in user. */
export function useLatestChangelogEntry(): ChangelogEntry | null {
  const { user } = useAuth();
  const query = useQuery({
    queryKey: queryKeys.changelogLatest(),
    queryFn: ({ signal }) => fetchLatestChangelogEntry(signal),
    enabled: Boolean(user),
    staleTime: Number.POSITIVE_INFINITY,
    retry: false,
  });
  return query.data ?? null;
}

/** The newest release and whether it is new to the user: what the badges show. */
export function useWhatsNew(): { latest: ChangelogEntry | null; unseen: boolean } {
  const { user } = useAuth();
  const latest = useLatestChangelogEntry();
  const unseen = Boolean(latest && user && isChangelogEntryUnseen(latest, user));
  return { latest, unseen };
}
