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
  return safely(() => sessionStorage.getItem(KEY), null) ?? localStorage.getItem(KEY);
}

export function writeOpenWorkspaceId(workspaceId: string): void {
  safely(() => sessionStorage.setItem(KEY, workspaceId), undefined);
  localStorage.setItem(KEY, workspaceId);
}

export function clearOpenWorkspaceId(): void {
  safely(() => sessionStorage.removeItem(KEY), undefined);
  localStorage.removeItem(KEY);
}
