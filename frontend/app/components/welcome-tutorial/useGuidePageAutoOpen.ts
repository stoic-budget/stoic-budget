'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { isPageCovered } from '@/app/components/page-hints/page-hints-dom';
import { useAuth } from '@/app/hooks/useAuth';
import { guidePageFor, isGuidePageDue } from './guide-pages';
import { loadGuideDialog } from './load-guide-dialog';
import { useTutorialSteps } from './useTutorialSteps';
import { TUTORIAL_PAGES } from './welcome-tutorial-routes';
import {
  openGuidePage,
  useWelcomeTutorialView,
  type WelcomeTutorialView,
} from './welcome-tutorial-store';

/**
 * The welcome window's buttons close it and then navigate, so the page it was open on is
 * about to be left: that visit gets no guide page. True until the person moves elsewhere.
 */
function useWelcomedOnThisPage(view: WelcomeTutorialView | null, pathname: string | null): boolean {
  const [welcomedOn, setWelcomedOn] = useState<string | null>(null);
  const next = view === 'welcome' ? pathname : welcomedOn === pathname ? welcomedOn : null;
  if (next !== welcomedOn) {
    setWelcomedOn(next);
  }
  return next !== null;
}

/** A link that opens a window on arrival (the upload drawer): it has not had time to show yet. */
function isWindowRequested(): boolean {
  const params = new URLSearchParams(window.location.search);
  return params.has('upload') || params.has('openExpenseDrawer');
}

/**
 * On the first visit to a sidebar page, opens the guide on that page alone: at once, its
 * code fetched ahead while any page is still due. Leaving the page before the code is there
 * cancels it, so the guide never appears over a page it is not about. Never over another
 * window: when something modal is open or on its way, the page waits for the next visit.
 */
export function useGuidePageAutoOpen(): void {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const view = useWelcomeTutorialView();
  const welcomedHere = useWelcomedOnThisPage(view, pathname);
  // Only pages the person has in the sidebar: a hidden page has no guide page either.
  const steps = useTutorialSteps();
  const page = !loading && pathname ? guidePageFor(pathname) : null;
  const due =
    page !== null &&
    view === null &&
    !welcomedHere &&
    steps.some(step => step.id === page) &&
    isGuidePageDue(user, page);
  const anyDue = !loading && TUTORIAL_PAGES.some(({ id }) => isGuidePageDue(user, id));

  useEffect(() => {
    if (anyDue) {
      // Only a head start: a failure is met again when the guide is asked for, below.
      loadGuideDialog().catch(() => undefined);
    }
  }, [anyDue]);

  useEffect(() => {
    if (!due || page === null) {
      return undefined;
    }
    let cancelled = false;
    loadGuideDialog()
      .then(() => {
        if (!cancelled && !isPageCovered() && !isWindowRequested()) {
          openGuidePage(page);
        }
      })
      // No code (offline, a new deploy): no guide this visit; the page itself works.
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [due, page]);
}
