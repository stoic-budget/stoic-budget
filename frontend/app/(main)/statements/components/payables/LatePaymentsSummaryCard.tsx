'use client';

import type React from 'react';
import { useIntlayer } from '@/app/i18n';
import { useLatePaymentsSummary } from './hooks/useLateReasons';

/**
 * The bills paid late over the last year, by the reason given: whether the
 * same thing keeps happening. Nothing late, nothing shown.
 */
export function LatePaymentsSummaryCard({
  enabled,
}: {
  enabled: boolean;
}): React.JSX.Element | null {
  const t = useIntlayer('lateReasons');
  const { data } = useLatePaymentsSummary(enabled);
  if (!(enabled && data && data.total > 0)) return null;
  const rows = [
    ...data.byReason.map(row => ({
      key: row.reason,
      label: t[row.reason].value,
      count: row.count,
    })),
    ...(data.unexplained > 0
      ? [{ key: 'none', label: t.notGiven.value, count: data.unexplained }]
      : []),
  ];
  return (
    <section
      aria-labelledby="late-payments-title"
      data-attention="late-payments"
      style={{
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        padding: 16,
        display: 'grid',
        gap: 8,
      }}
    >
      <h2
        id="late-payments-title"
        style={{ margin: 0, fontSize: 15, fontWeight: 500, color: 'var(--foreground)' }}
      >
        {t.summaryTitle.value}{' '}
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>{data.total}</span>
      </h2>
      <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: 4 }}>
        {rows.map(row => (
          <li
            key={row.key}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: 12,
              fontSize: 14,
              color: 'var(--text-muted)',
            }}
          >
            <span>{row.label}</span>
            <span style={{ color: 'var(--foreground)', fontVariantNumeric: 'tabular-nums' }}>
              {row.count}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
