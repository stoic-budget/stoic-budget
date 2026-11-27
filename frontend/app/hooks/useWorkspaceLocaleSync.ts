'use client';

import { useEffect } from 'react';
import { useWorkspace } from '@/app/contexts/WorkspaceContext';
import { useLocale } from '@/app/i18n';
import { isSupportedLocale, readLocaleFromCookie } from '@/app/lib/locale';
import { notifyUserFormatChanged } from '@/app/lib/user-format-store';
import { saveWorkspaceLocale, workspaceLocale } from '@/app/lib/workspace-locale-api';

/**
 * Each workspace keeps the caller's own interface language: entering one
 * switches the app to it. A workspace with none yet takes the language in use
 * when it is entered, so it stays put from then on.
 */
export function useWorkspaceLocaleSync(): void {
  const { currentWorkspace } = useWorkspace();
  const { setLocale } = useLocale();
  // A past version is looked at from inside its workspace: it keeps the language in use.
  const workspace = currentWorkspace?.kind === 'version' ? null : currentWorkspace;
  const workspaceId = workspace?.id ?? null;
  const wanted = workspace ? workspaceLocale(workspace) : null;

  useEffect(() => {
    if (!workspaceId) return;
    // The cookie, not the rendered locale: it is what the next page load renders.
    const inUse = readLocaleFromCookie();
    if (isSupportedLocale(wanted)) {
      if (wanted !== inUse) {
        setLocale(wanted);
        notifyUserFormatChanged();
      }
      return;
    }
    if (inUse) {
      saveWorkspaceLocale(workspaceId, inUse).catch((error: unknown) => {
        console.error('Failed to save the workspace language:', error);
      });
    }
  }, [workspaceId, wanted, setLocale]);
}
