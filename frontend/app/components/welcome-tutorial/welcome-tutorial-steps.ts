import type { ReactElement, ReactNode } from 'react';
import type { NavItem } from '@/app/components/navigation/helpers/navigation-config';
import { TUTORIAL_PAGES, type TutorialStepId } from './welcome-tutorial-routes';

export const TUTORIAL_POINTS: Record<TutorialStepId, readonly string[]> = {
  dashboard: ['categories', 'month', 'recent'],
  statements: ['list', 'upload'],
  tables: ['grid', 'list'],
  workspaces: ['list', 'members', 'categories'],
  reports: ['flow', 'templates', 'categories'],
  taxDeclaration: ['gate', 'steps'],
  netWorth: ['chart', 'allocation', 'risk'],
  budgets: ['cards', 'over'],
  advice: ['info', 'attention'],
  goals: ['list', 'progress'],
  roi: ['chart', 'inputs', 'table'],
  subscriptions: ['calendar', 'kpis', 'list'],
  crypto: ['wallets', 'connect'],
};

export interface TutorialStep {
  id: TutorialStepId;
  path: string;
  /** The sidebar label, as a node for rendering. */
  label: ReactNode;
  /** The same label as plain text, for attributes. */
  title: string;
  icon: ReactElement;
  /** Keys of the page's points in the `welcomeTutorialSteps` dictionary, in reading order. */
  points: readonly string[];
}

/**
 * One step per page the user actually has in the sidebar, in sidebar order: a page
 * the sidebar hides (no permission, experimental) is not explained either.
 */
export function buildTutorialSteps(
  visibleNavItems: NavItem[],
  titleOf: (id: TutorialStepId) => string,
): TutorialStep[] {
  return TUTORIAL_PAGES.flatMap(page => {
    const item = visibleNavItems.find(navItem => navItem.path === page.path);
    if (!item) {
      return [];
    }
    return [
      {
        id: page.id,
        path: page.path,
        label: item.label,
        title: titleOf(page.id),
        icon: item.icon,
        points: TUTORIAL_POINTS[page.id],
      },
    ];
  });
}
