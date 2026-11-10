import type { AuthUser } from '@/app/lib/contracts';
import { DEFAULT_APP_ROUTE } from '@/app/lib/default-app-route';
import { syncLocaleFromUser } from '@/app/lib/locale';

/**
 * Where the browser goes once a sign-in answered with the user: the same for
 * a password and for single sign-on. The tokens are httpOnly cookies already;
 * only the profile for the first render is kept here.
 */
export function finishSignIn(
  user: AuthUser,
  options: { inviteToken: string | null; nextPath: string | null },
): void {
  localStorage.setItem('user', JSON.stringify(user));
  syncLocaleFromUser(user);
  if (user.workspaceId) {
    localStorage.setItem('currentWorkspaceId', user.workspaceId);
  }

  if (!options.inviteToken && user.onboardingCompletedAt == null) {
    window.location.href = '/onboarding';
    return;
  }

  const activeWorkspaceId = user.lastWorkspaceId || user.workspaceId;
  if (activeWorkspaceId) {
    localStorage.setItem('currentWorkspaceId', activeWorkspaceId);
    window.location.href = options.nextPath || DEFAULT_APP_ROUTE;
  } else {
    window.location.href = '/workspaces';
  }
}
