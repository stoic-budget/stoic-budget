'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { isPageCovered } from '@/app/components/page-hints/page-hints-dom';
import { guidePageFor, isGuidePageDue } from '@/app/components/welcome-tutorial/guide-pages';
import { isTutorialRoute } from '@/app/components/welcome-tutorial/welcome-tutorial-routes';
import { useWelcomeTutorialView } from '@/app/components/welcome-tutorial/welcome-tutorial-store';
import type { User } from '@/app/contexts/AuthContext';
import { useAuth } from '@/app/hooks/useAuth';
import { useMarkChangelogSeen, useWhatsNew } from './useWhatsNew';
import { claimWhatsNewAutoOpen, openWhatsNew } from './whats-new-store';

// Later than the welcome window and the guide pages, which open first and win.
export const WHATS_NEW_AUTO_OPEN_DELAY_MS = 1500;

/**
 * Whether the person is past every first-run window: onboarding finished, the
 * welcome window closed, and no guide page about to open on this page.
 */
export function isPastFirstRun(user: User | null, pathname: string | null): boolean {
  if (!(user?.onboardingCompletedAt && typeof user.welcomeTutorialSeenAt === 'string')) {
    return false;
  }
  if (!(pathname && isTutorialRoute(pathname))) {
    return false;
  }
  const page = guidePageFor(pathname);
  return page === null || !isGuidePageDue(user, page);
}

/**
 * Opens What's new by itself once per release: when the newest entry is new to
 * the user, on a sidebar page, after onboarding, the welcome window and the guide
 * are done, and never over another window. Showing it marks it seen on the server,
 * so it does not open again here or on another device.
 */
export function useWhatsNewAutoOpen(): void {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const view = useWelcomeTutorialView();
  const { latest, unseen } = useWhatsNew();
  const markSeen = useMarkChangelogSeen();
  const due = !loading && unseen && view === null && isPastFirstRun(user, pathname);

  useEffect(() => {
    if (!(due && latest)) {
      return undefined;
    }
    // The claim sits inside the timer, so a visit cut short does not use it up.
    const timer = window.setTimeout(() => {
      if (!isPageCovered() && claimWhatsNewAutoOpen()) {
        openWhatsNew(latest);
        markSeen(latest);
      }
    }, WHATS_NEW_AUTO_OPEN_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [due, latest, markSeen, pathname]);
}
