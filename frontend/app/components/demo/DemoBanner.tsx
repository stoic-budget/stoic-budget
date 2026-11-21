'use client';

import type React from 'react';
import { BAR_STYLE } from '@/app/components/versions/VersionBanner';
import { useDemoStatus } from '@/app/hooks/useDemoStatus';
import { useIntlayer } from '@/app/i18n';

/** What the demo is, where its data comes from and how to run one's own. */
export const DEMO_ABOUT_URL = 'https://stoic-budget.github.io/stoic-budget/docs/deployment/demo';

/**
 * A slim strip across the top of a read-only demo server: sample data, reset
 * every night, nothing can change. Asks the server once whether it is a demo.
 */
export function DemoBanner(): React.JSX.Element | null {
  const status = useDemoStatus();
  const t = useIntlayer('demoBanner');
  if (!status?.enabled) {
    return null;
  }
  return (
    <div role="status" style={BAR_STYLE}>
      <span>{t.message}</span>
      <a
        href={DEMO_ABOUT_URL}
        target="_blank"
        rel="noreferrer"
        style={{ color: 'var(--primary)', textDecoration: 'none' }}
      >
        {t.about}
      </a>
    </div>
  );
}
