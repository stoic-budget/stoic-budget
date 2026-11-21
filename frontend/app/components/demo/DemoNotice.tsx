'use client';

import type React from 'react';
import { useIsDemo } from '@/app/hooks/useDemoStatus';
import { useIntlayer } from '@/app/i18n';

/**
 * A line at the top of a form, drawer or dialog on a demo server: the data is
 * sample data and nothing done here is saved. Renders nothing elsewhere.
 */
export function DemoNotice(): React.JSX.Element | null {
  const isDemo = useIsDemo();
  const t = useIntlayer('demoBanner');
  if (!isDemo) {
    return null;
  }
  return (
    <p
      role="note"
      style={{
        display: 'flex',
        alignItems: 'baseline',
        gap: 8,
        margin: '0 0 16px',
        padding: '8px 12px',
        borderRadius: 8,
        background: 'var(--surface-soft)',
        color: 'var(--text-muted)',
        fontSize: 13,
        lineHeight: 1.4,
      }}
    >
      <span
        aria-hidden
        style={{
          flex: 'none',
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: 'var(--attention)',
          transform: 'translateY(-1px)',
        }}
      />
      <span>{t.editNotice}</span>
    </p>
  );
}
