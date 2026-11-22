'use client';

import Button from '@mui/material/Button';
import { useState } from 'react';
import { ChevronLeft, ChevronRight } from '@/app/components/icons';
import { useIntlayer } from '@/app/i18n';
import type { LoanSchedule } from '@/app/lib/contracts';
import { cardStyle, formatDay, mutedStyle, titleStyle } from '../account-detail-styles';

/** A year of payments per page: 360 rows read as 30 pages, not one endless list. */
export const ROWS_PER_PAGE = 12;

const cell = {
  padding: '8px 10px',
  textAlign: 'right',
  whiteSpace: 'nowrap',
  fontVariantNumeric: 'tabular-nums',
  borderTop: '1px solid var(--border)',
} as const;
const head = { ...cell, fontWeight: 500, color: 'var(--text-muted)', fontSize: 13, borderTop: 0 };

/** The page that holds the first payment still ahead, so the table opens on today. */
export function currentPage(schedule: LoanSchedule): number {
  const next = schedule.plan.rows.findIndex(row => row.date > schedule.today);
  return next < 0
    ? Math.max(0, Math.ceil(schedule.plan.rows.length / ROWS_PER_PAGE) - 1)
    : Math.floor(next / ROWS_PER_PAGE);
}

export function LoanScheduleTable({
  schedule,
  money,
  locale,
}: {
  schedule: LoanSchedule;
  money: (value: number) => string;
  locale: string;
}): React.JSX.Element {
  const t = useIntlayer('loanSchedule');
  const rows = schedule.plan.rows;
  const pages = Math.max(1, Math.ceil(rows.length / ROWS_PER_PAGE));
  const [picked, setPicked] = useState<number | null>(null);
  const page = Math.min(picked ?? currentPage(schedule), pages - 1);
  const shown = rows.slice(page * ROWS_PER_PAGE, (page + 1) * ROWS_PER_PAGE);
  const hasExtra = rows.some(row => row.extra > 0);
  const hasActual = rows.some(row => row.actualBalance !== null);

  return (
    <section style={cardStyle}>
      <div
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}
      >
        <h2 style={titleStyle}>{t.scheduleTitle}</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <Button
            variant="text"
            aria-label={t.previous.value}
            disabled={page === 0}
            onClick={() => setPicked(page - 1)}
            sx={{ minWidth: 0, px: 1 }}
          >
            <ChevronLeft size={18} aria-hidden />
          </Button>
          <span style={{ ...mutedStyle, fontVariantNumeric: 'tabular-nums' }}>
            {t.yearOf.value
              .replace('{{year}}', String(page + 1))
              .replace('{{total}}', String(pages))}
          </span>
          <Button
            variant="text"
            aria-label={t.next.value}
            disabled={page >= pages - 1}
            onClick={() => setPicked(page + 1)}
            sx={{ minWidth: 0, px: 1 }}
          >
            <ChevronRight size={18} aria-hidden />
          </Button>
        </div>
      </div>
      {/* A phone scrolls the table inside the card, never the page. */}
      <div style={{ overflowX: 'auto', margin: '0 -10px' }}>
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: 14,
            color: 'var(--foreground)',
          }}
        >
          <thead>
            <tr>
              <th style={{ ...head, textAlign: 'left' }}>{t.date}</th>
              <th style={head}>{t.payment}</th>
              <th style={head}>{t.interest}</th>
              <th style={head}>{t.principalPart}</th>
              {hasExtra && <th style={head}>{t.extra}</th>}
              <th style={head}>{t.balance}</th>
              {hasActual && <th style={head}>{t.actual}</th>}
            </tr>
          </thead>
          <tbody>
            {shown.map(row => (
              <tr
                key={row.period}
                style={row.date <= schedule.today ? { color: 'var(--text-muted)' } : undefined}
              >
                <td style={{ ...cell, textAlign: 'left' }}>{formatDay(row.date, locale)}</td>
                <td style={cell}>{money(row.payment)}</td>
                <td style={cell}>{money(row.interest)}</td>
                <td style={cell}>{money(row.principal)}</td>
                {hasExtra && <td style={cell}>{row.extra > 0 ? money(row.extra) : ''}</td>}
                <td style={cell}>{money(row.balance)}</td>
                {hasActual && (
                  <td style={cell}>{row.actualBalance === null ? '' : money(row.actualBalance)}</td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
