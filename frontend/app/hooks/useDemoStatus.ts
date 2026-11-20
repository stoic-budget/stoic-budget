import { useEffect, useSyncExternalStore } from 'react';
import type { DemoStatus } from '@/app/lib/contracts';
import { apiQueryDecoded } from '@/app/lib/query-fn-schema';

/**
 * Whether this server is a public read-only demo (`GET /auth/demo`). Asked
 * once per page load by the few places that need the answer first (the
 * banner, the login page); everything else only reads what is known, so an
 * isolated component never sends the request.
 */
const STORAGE_KEY = 'demo-status';

/**
 * The last answer, kept so the app knows on its first render after the login
 * page asked: a background write (the daily advice refresh) would otherwise go
 * out before the answer and come back refused.
 */
function readStored(): DemoStatus | null {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
    return typeof parsed === 'object' && parsed !== null && 'enabled' in parsed
      ? { enabled: parsed.enabled === true, account: null }
      : null;
  } catch {
    return null;
  }
}

let status: DemoStatus | null = typeof window === 'undefined' ? null : readStored();
let requested = false;
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function load(): void {
  if (requested) {
    return;
  }
  requested = true;
  void apiQueryDecoded({ url: '/auth/demo', contract: 'DemoStatus' })
    .then(next => {
      status = next;
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ enabled: next.enabled }));
      } catch {
        // Blocked storage: known for this page only.
      }
      for (const listener of listeners) listener();
    })
    .catch(() => {
      // Unknown means "not a demo": the stored answer may be from another
      // server on this origin, so it is not trusted either. No retry here; the
      // next full page load asks again.
      status = { enabled: false, account: null };
      for (const listener of listeners) listener();
    });
}

/** The demo status, asked for if nobody has yet; null until the server answers. */
export function useDemoStatus(): DemoStatus | null {
  useEffect(load, []);
  return useSyncExternalStore(
    subscribe,
    () => status,
    () => null,
  );
}

/** Whether this is a demo, as far as known. Never asks the server itself. */
export function useIsDemo(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => status?.enabled === true,
    () => false,
  );
}

/**
 * Whether this is a demo, as far as known right now: for effects and event
 * handlers, which run after hydration has settled on the server's snapshot.
 */
export function isDemoInstance(): boolean {
  return status?.enabled === true;
}

/** Tests only: what the server would have answered (null forgets it). */
export function setDemoStatusForTests(next: DemoStatus | null): void {
  status = next;
  requested = next !== null;
  for (const listener of listeners) listener();
}
