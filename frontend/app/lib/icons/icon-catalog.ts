'use client';

import { useEffect, useMemo, useSyncExternalStore } from 'react';
import type { IconNode } from '../category-line-icons';
import { fetchIconNodes, fetchIconWords } from '../icon-catalog-api';

interface Loaded<T> {
  status: 'idle' | 'loading' | 'ready' | 'failed';
  value: T | null;
}

/**
 * A file fetched once per page load and shared by every reader: the first
 * reader starts it, the rest wait on the same request. A failure is tried
 * again by the next reader that mounts.
 */
function lazyResource<T>(load: () => Promise<T>) {
  let state: Loaded<T> = { status: 'idle', value: null };
  const listeners = new Set<() => void>();
  const set = (next: Loaded<T>) => {
    state = next;
    for (const listener of listeners) {
      listener();
    }
  };
  return {
    get: () => state,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    ensure: () => {
      if (state.status === 'loading' || state.status === 'ready') {
        return;
      }
      set({ status: 'loading', value: null });
      load().then(
        value => set({ status: 'ready', value }),
        (error: unknown) => {
          console.error('Icon catalogue failed to load:', error);
          set({ status: 'failed', value: null });
        },
      );
    },
  };
}

const IDLE: Loaded<never> = { status: 'idle', value: null };
const nodes = lazyResource(fetchIconNodes);
const words = lazyResource(fetchIconWords);

function useResource<T>(resource: ReturnType<typeof lazyResource<T>>, enabled = true): Loaded<T> {
  const state = useSyncExternalStore(resource.subscribe, resource.get, () => IDLE);
  useEffect(() => {
    if (enabled) {
      resource.ensure();
    }
  }, [resource, enabled]);
  return state;
}

/**
 * One icon's drawing: undefined while the catalogue loads, null when the
 * catalogue has no such icon (or could not be loaded).
 */
export function useIconNode(name: string): IconNode | null | undefined {
  const state = useResource(nodes);
  if (state.status === 'ready') {
    return state.value?.[name] ?? null;
  }
  return state.status === 'failed' ? null : undefined;
}

export interface IconCatalog {
  /** Every icon name, alphabetical. */
  names: string[];
  drawings: Record<string, IconNode>;
  /** English search words by name. */
  words: Record<string, string[]>;
}

/** The whole catalogue for the picker: null until both files are in. */
export function useIconCatalog(enabled: boolean): {
  catalog: IconCatalog | null;
  failed: boolean;
} {
  const drawn = useResource(nodes, enabled);
  const searched = useResource(words, enabled);
  const failed = drawn.status === 'failed' || searched.status === 'failed';
  const catalog = useMemo(
    () =>
      drawn.value && searched.value
        ? { names: Object.keys(drawn.value).sort(), drawings: drawn.value, words: searched.value }
        : null,
    [drawn.value, searched.value],
  );
  return { catalog, failed };
}
