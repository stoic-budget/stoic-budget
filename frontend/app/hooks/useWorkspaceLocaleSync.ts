'use client';

import { useEffect, useRef } from 'react';
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
  // intlayer hands out a new setLocale on every language change. As a dependency it
  // would rerun the sync after each one and undo a language picked elsewhere
  // (the onboarding step), so the effect reads it through a ref.
  const setLocaleRef = useRef(setLocale);
  useEffect(() => {
    setLocaleRef.current = setLocale;
  }, [setLocale]);
  // A past version is looked at from inside its workspace: it keeps the language in use.
  const workspace = currentWorkspace?.kind === 'version' ? null : currentWorkspace;
  const workspaceId = workspace?.id ?? null;
  // `GET /workspaces` answers it (WorkspaceSummary); the context's type leaves it out.
  const listed: unknown = workspace && 'memberLocale' in workspace ? workspace.memberLocale : null;
  const listedLocale = typeof listed === 'string' ? listed : null;

  // Runs on entering a workspace, or when the list brings a new language for it;
  // never because of its own save, which would undo the next language picked.
  useEffect(() => {
    if (!workspaceId) return;
    const wanted = workspaceLocale({ id: workspaceId, memberLocale: listedLocale });
    // The cookie, not the rendered locale: it is what the next page load renders.
    const inUse = readLocaleFromCookie();
    if (isSupportedLocale(wanted)) {
      if (wanted !== inUse) {
        setLocaleRef.current(wanted);
        notifyUserFormatChanged();
      }
      return;
    }
    if (inUse) {
      saveWorkspaceLocale(workspaceId, inUse).catch((error: unknown) => {
        console.error('Failed to save the workspace language:', error);
      });
    }
  }, [workspaceId, listedLocale]);
}
