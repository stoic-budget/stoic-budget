'use client';

import { useLayoutEffect } from 'react';
import toast, { useToasterStore } from 'react-hot-toast';
import { VERSION_READ_ONLY_TOAST_ID } from '@/app/lib/api';

/**
 * A refused write (past version, demo server) is explained once, by the quiet
 * note the api client shows. Most callers also catch the error and
 * `toast.error(getApiErrorMessage(err))`, which repeats the same words in red;
 * this drops that echo while the note is on screen. It sits beside the
 * Toaster so the ~90 callers stay as they are, and every caller's own catch
 * still runs (loading states end, forms roll back). A layout effect removes
 * the echo before the browser paints it.
 */
export function ReadOnlyEchoFilter(): null {
  const { toasts } = useToasterStore();

  useLayoutEffect(() => {
    const note = toasts.find(t => t.id === VERSION_READ_ONLY_TOAST_ID && t.visible);
    if (!note || typeof note.message !== 'string') {
      return;
    }
    for (const t of toasts) {
      if (t.type === 'error' && t.message === note.message) {
        toast.remove(t.id);
      }
    }
  }, [toasts]);

  return null;
}
