'use client';

import { useSyncExternalStore } from 'react';
import type { ChangelogEntry } from '@/app/components/ChangelogModal';

/** The entry the What's new dialog shows, or null while it is closed. */
let openEntry: ChangelogEntry | null = null;
// Opens by itself at most once per page load, even if its host remounts.
let autoOpenClaimed = false;
const listeners = new Set<() => void>();

function emit(next: ChangelogEntry | null): void {
  openEntry = next;
  for (const listener of listeners) {
    listener();
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function openWhatsNew(entry: ChangelogEntry): void {
  emit(entry);
}

export function closeWhatsNew(): void {
  emit(null);
}

export function useWhatsNewEntry(): ChangelogEntry | null {
  return useSyncExternalStore(
    subscribe,
    () => openEntry,
    () => null,
  );
}

/** True the first time only. */
export function claimWhatsNewAutoOpen(): boolean {
  if (autoOpenClaimed) {
    return false;
  }
  autoOpenClaimed = true;
  return true;
}

/** Tests start each case with a closed dialog and an unused automatic opening. */
export function resetWhatsNewStoreForTests(): void {
  autoOpenClaimed = false;
  emit(null);
}
