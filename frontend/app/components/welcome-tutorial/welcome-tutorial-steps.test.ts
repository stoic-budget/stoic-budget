import { describe, expect, it } from 'vitest';
import { buildNavItems } from '@/app/components/navigation/helpers/navigation-config';
import { TUTORIAL_PAGES } from './welcome-tutorial-routes';
import { buildTutorialSteps, TUTORIAL_POINTS } from './welcome-tutorial-steps';
import stepTexts from './welcome-tutorial-steps.content';

// Labels are the dictionary keys themselves, which is enough to tell items apart.
const nav = new Proxy({}, { get: (_target, key) => String(key) }) as Parameters<
  typeof buildNavItems
>[0];

type StepText = { tagline: unknown; description: unknown; points: Record<string, unknown> };

describe('welcome tutorial steps', () => {
  // Not every sidebar page has a step yet (Pay, Receive, Transactions, Review,
  // Forecast and Invoices came later); buildTutorialSteps skips those.
  it('only has steps for sidebar pages, in sidebar order', () => {
    const sidebar = buildNavItems(nav)
      .filter(item => !item.experimental)
      .map(item => item.path);
    const paths: string[] = TUTORIAL_PAGES.map(page => page.path);
    expect(paths.filter(p => !sidebar.includes(p))).toEqual([]);
    expect(sidebar.filter(p => paths.includes(p))).toEqual(paths);
  });

  it('skips pages the sidebar hides and keeps the order of the rest', () => {
    const visible = buildNavItems(nav).filter(item => item.path !== '/goals');
    const steps = buildTutorialSteps(visible, id => `title:${id}`);

    expect(steps.map(step => step.id)).not.toContain('goals');
    expect(steps.map(step => step.id).slice(0, 3)).toEqual(['dashboard', 'statements', 'budgets']);
    expect(steps[0]).toMatchObject({ path: '/dashboard', label: 'dashboard', title: 'title:dashboard' });
  });

  it('has the texts of every step and of every point', () => {
    const texts = stepTexts.content.steps as unknown as Record<string, StepText>;
    for (const page of TUTORIAL_PAGES) {
      const text = texts[page.id];
      expect(text?.tagline, page.id).toBeDefined();
      expect(text?.description, page.id).toBeDefined();
      expect(Object.keys(text.points).sort(), page.id).toEqual([...TUTORIAL_POINTS[page.id]].sort());
    }
  });
});
