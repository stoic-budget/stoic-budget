/**
 * The workspace open in this tab (#682). Each tab keeps its own in
 * sessionStorage, so switching in one tab no longer sends another tab's
 * requests into a workspace it does not show. localStorage holds the last
 * one picked anywhere and is only the default for a tab that has none yet
 * (a new tab, a sign-in).
 */
const KEY = 'currentWorkspaceId';

const safely = <T>(read: () => T, fallback: T): T => {
  try {
    return read();
  } catch {
    return fallback;
  }
};

export function readOpenWorkspaceId(): string | null {
  if (typeof window === 'undefined') return null;
  const own = safely(() => sessionStorage.getItem(KEY), null);
  if (own) return own;
  // A new tab takes the default once and keeps it: another tab switching
  // while this one is still loading must not move it.
  const shared = localStorage.getItem(KEY);
  if (shared) safely(() => sessionStorage.setItem(KEY, shared), undefined);
  return shared;
}

/**
 * Opens a workspace in this tab. `shared: false` keeps it to this tab: a
 * past version is entered on purpose and is never where a new tab starts.
 */
export function writeOpenWorkspaceId(workspaceId: string, { shared = true } = {}): void {
  safely(() => sessionStorage.setItem(KEY, workspaceId), undefined);
  if (shared) localStorage.setItem(KEY, workspaceId);
}

export function clearOpenWorkspaceId(): void {
  safely(() => sessionStorage.removeItem(KEY), undefined);
  localStorage.removeItem(KEY);
}

/** The three above as one name, for files that already import the api client. */
export const tabWorkspace = {
  read: readOpenWorkspaceId,
  write: writeOpenWorkspaceId,
  clear: clearOpenWorkspaceId,
};
