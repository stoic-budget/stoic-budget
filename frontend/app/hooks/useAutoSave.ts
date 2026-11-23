import { type RefObject, useEffect, useRef } from 'react';

type UseAutoSaveOptions<T> = {
  data: T;
  onSave: (data: T) => Promise<void>;
  debounceMs?: number;
  enabled?: boolean;
  isEqual?: (a: T, b: T) => boolean;
};

// Shallow comparison for the common flat-form case; JSON.stringify on every
// render was measurable on the statement editor. Nested values fall back to
// reference equality, callers with deep shapes pass their own `isEqual`.
const defaultIsEqual = <T>(a: T, b: T): boolean => {
  if (Object.is(a, b)) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  const left = a as Record<string, unknown>;
  const right = b as Record<string, unknown>;
  const keys = Object.keys(left);
  if (keys.length !== Object.keys(right).length) return false;
  return keys.every(key => Object.is(left[key], right[key]));
};

type Pending<T> = { data: T; save: (data: T) => Promise<void> };

type SaveRefs<T> = {
  pending: RefObject<Pending<T> | null>;
  lastSaved: RefObject<T>;
  /** Counts saves sent: only the latest one to succeed says what is stored. */
  sent: RefObject<number>;
};

/** Saves the pending value. A failed save is not marked saved, so the next edit retries it. */
async function flushPending<T>({ pending, lastSaved, sent }: SaveRefs<T>): Promise<void> {
  const next = pending.current;
  pending.current = null;
  if (!next) return;
  sent.current += 1;
  const mine = sent.current;
  try {
    await next.save(next.data);
    // An older save answering late must not stand in for a newer value.
    if (mine === sent.current) lastSaved.current = next.data;
  } catch {
    // The caller has told the person; the value stays unsaved.
  }
}

export function useAutoSave<T>({
  data,
  onSave,
  debounceMs = 500,
  enabled = true,
  isEqual = defaultIsEqual,
}: UseAutoSaveOptions<T>): void {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The value waiting on the timer, sent at once if the page goes away first.
  const pendingRef = useRef<Pending<T> | null>(null);
  const lastSavedRef = useRef(data);
  const sentRef = useRef(0);
  const initializedRef = useRef(false);
  const wasEnabledRef = useRef(enabled);

  useEffect(() => {
    if (!enabled) {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      // A reload disables the form: what was typed is sent, not dropped.
      void flushPending({ pending: pendingRef, lastSaved: lastSavedRef, sent: sentRef });
      initializedRef.current = false;
      wasEnabledRef.current = false;
      return;
    }

    if (!(wasEnabledRef.current && initializedRef.current)) {
      lastSavedRef.current = data;
      initializedRef.current = true;
      wasEnabledRef.current = true;
      return;
    }

    if (isEqual(data, lastSavedRef.current)) {
      return;
    }

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    pendingRef.current = { data, save: onSave };
    timeoutRef.current = setTimeout(
      () => void flushPending({ pending: pendingRef, lastSaved: lastSavedRef, sent: sentRef }),
      debounceMs,
    );

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [data, debounceMs, enabled, isEqual, onSave]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      // Leaving the page within the debounce still saves what was typed.
      void flushPending({ pending: pendingRef, lastSaved: lastSavedRef, sent: sentRef });
    };
  }, []);
}
