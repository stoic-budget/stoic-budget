import type { AuthUser } from '@/app/lib/contracts';
import { DEFAULT_APP_ROUTE } from '@/app/lib/default-app-route';
import { syncLocaleFromUser } from '@/app/lib/locale';

/**
 * After any sign-in (password or passkey): the tokens already sit in httpOnly
 * cookies, so only the profile for the first render is kept, then the browser
 * goes where the person was heading.
 */
export function completeSignIn(
  user: AuthUser,
  { inviteToken, nextPath }: { inviteToken: string | null; nextPath: string | null },
): void {
  localStorage.setItem('user', JSON.stringify(user));
  syncLocaleFromUser(user);
  if (user.workspaceId) {
    localStorage.setItem('currentWorkspaceId', user.workspaceId);
  }

  if (!inviteToken && user.onboardingCompletedAt == null) {
    window.location.href = '/onboarding';
    return;
  }

  const activeWorkspaceId = user.lastWorkspaceId || user.workspaceId;

  if (activeWorkspaceId) {
    localStorage.setItem('currentWorkspaceId', activeWorkspaceId);
    window.location.href = nextPath || DEFAULT_APP_ROUTE;
  } else {
    window.location.href = '/workspaces';
  }
}
