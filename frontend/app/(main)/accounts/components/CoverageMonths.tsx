'use client';

import { useIntlayer, useLocale } from '@/app/i18n';
import type { CoverageMonth, CoverageMonthState } from '@/app/lib/contracts';
import { tokens } from '@/lib/theme-tokens';
import { mutedStyle } from './account-detail-styles';

/** Covered is the accent, a part ochre, a gap an empty dashed track, an overlap dusty blue. */
const FILL: Record<CoverageMonthState, string> = {
  covered: 'var(--primary)',
  partial: 'var(--attention)',
  gap: 'var(--icon-badge-bg)',
  overlap: 'var(--cat-tone-4)',
};

const cellStyle = (state: CoverageMonthState | null) =>
  ({
    height: 18,
    borderRadius: tokens.radius.xs,
    background: state ? FILL[state] : 'transparent',
    border: state === 'gap' ? '1px dashed var(--text-muted)' : '1px solid transparent',
  }) as const;

const rowStyle = {
  display: 'grid',
  gridTemplateColumns: '40px repeat(12, minmax(0, 1fr))',
  gap: 4,
  alignItems: 'center',
} as const;

/** One row per year, a cell per month: which months the account's statements cover. */
export function CoverageMonths({
  months,
}: {
  months: readonly CoverageMonth[];
}): React.JSX.Element {
  const t = useIntlayer('accountsPage');
  const { locale } = useLocale();
  const byMonth = new Map(months.map(month => [month.month, month]));
  const years = [...new Set(months.map(month => Number(month.month.slice(0, 4))))];
  const monthName = (month: number, style: 'narrow' | 'long') =>
    new Intl.DateTimeFormat(locale, { month: style, timeZone: 'UTC' }).format(
      new Date(Date.UTC(2026, month, 1)),
    );
  const legend: Array<[CoverageMonthState, string]> = [
    ['covered', t.coverageLegendCovered.value],
    ['partial', t.coverageLegendPartial.value],
    ['gap', t.coverageLegendGap.value],
    ['overlap', t.coverageLegendOverlap.value],
  ];

  return (
    <div style={{ display: 'grid', gap: 6 }}>
      <div style={rowStyle} aria-hidden>
        <span />
        {Array.from({ length: 12 }, (_, index) => (
          <span key={index} style={{ ...mutedStyle, textAlign: 'center' }}>
            {monthName(index, 'narrow')}
          </span>
        ))}
      </div>
      {years.map(year => (
        <div key={year} style={rowStyle}>
          <span style={{ ...mutedStyle, fontVariantNumeric: 'tabular-nums' }}>{year}</span>
          {Array.from({ length: 12 }, (_, index) => {
            const month = byMonth.get(`${year}-${String(index + 1).padStart(2, '0')}`);
            if (!month) {
              return <span key={index} style={cellStyle(null)} />;
            }
            const label = `${monthName(index, 'long')} ${year}: ${month.coveredDays}/${month.days}`;
            return (
              <span
                key={index}
                role="img"
                aria-label={label}
                title={label}
                data-state={month.state}
                style={cellStyle(month.state)}
              />
            );
          })}
        </div>
      ))}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 14px', marginTop: 2 }}>
        {legend.map(([state, label]) => (
          <span
            key={state}
            style={{ ...mutedStyle, display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <span aria-hidden style={{ ...cellStyle(state), width: 10, height: 10 }} />
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}
