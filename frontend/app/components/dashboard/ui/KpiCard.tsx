import LinearProgress from '@mui/material/LinearProgress';
import clsx from 'clsx';
import Link from 'next/link';
import type React from 'react';
import { PRIVATE_CLASS } from '@/app/components/ui/private-amount';
import { GRID_COLUMNS } from '../overview-layout';
import { useSectionSpan } from '../section-span';
import { Figure } from './Figure';
import { Sparkline } from './Sparkline';

export type KpiTone = 'neutral' | 'positive' | 'negative' | 'warning' | 'info';

export interface KpiCardProps {
  label: string;
  value: React.ReactNode;
  /** The figure is a count, not an amount: it stays readable in privacy mode. */
  plainValue?: boolean;
  tone?: KpiTone;
  caption?: React.ReactNode;
  /** A quiet line under the caption that qualifies the figure ("Month in progress"). */
  note?: React.ReactNode;
  /** Sparkline points; the line takes the card's tone colour, as does a dot by the label. */
  spark?: { points: number[] };
  /** Renders the whole card as a link. */
  href?: string;
  /** Marks the card as the target of a `?focus=` deep link. */
  attentionId?: string;
  /** With half a row or more: a longer sparkline in place of `spark`. */
  wideSpark?: { points: number[] };
  /**
   * Label–value lines under the figure. A value is an amount, redacted in
   * privacy mode, unless `plain` (it marks its own amounts).
   */
  details?: Array<{ label: string; value: React.ReactNode; plain?: boolean }>;
  /** With half a row or more: a full chart in place of the sparkline. */
  wideChart?: React.ReactNode;
  /** The figure the Overview leads with: it takes its tone's colour, not only the dot. */
  lead?: boolean;
  /** A share used, in percent: a bar at the foot of the tile in place of the sparkline. */
  meter?: { percent: number };
}

const METER_FILL: Record<KpiTone, string> = {
  neutral: 'var(--primary)',
  positive: 'var(--primary)',
  info: 'var(--primary)',
  warning: 'var(--attention)',
  negative: 'var(--money-down)',
};

/** How much is used, at the foot of the tile; over the limit the bar stays full and a tick says so. */
function KpiMeter({ percent, tone }: { percent: number; tone: KpiTone }): React.JSX.Element {
  return (
    <div className="seneca-dashboard__stat-meter" aria-hidden="true">
      <div className="seneca-dashboard__budget-bar" data-tone={percent > 100 ? 'over' : undefined}>
        <LinearProgress
          variant="determinate"
          value={Math.min(Math.max(percent, 0), 100)}
          sx={{
            height: 5,
            borderRadius: 3,
            bgcolor: 'var(--icon-badge-bg)',
            '& .MuiLinearProgress-bar': { bgcolor: METER_FILL[tone], borderRadius: 3 },
          }}
        />
      </div>
    </div>
  );
}

export function KpiCard({
  label,
  value,
  plainValue = false,
  tone = 'neutral',
  caption,
  note,
  spark,
  href,
  attentionId,
  wideSpark,
  details,
  wideChart,
  lead = false,
  meter,
}: KpiCardProps): React.JSX.Element {
  // A tile given half a row or more has room to say more than its figure.
  const roomy = useSectionSpan() >= GRID_COLUMNS / 2;
  const chart = roomy ? wideChart : undefined;
  const line = chart || meter ? undefined : roomy && wideSpark ? wideSpark : spark;
  const body = (
    <>
      <div className="seneca-dashboard__stat-label">
        {/* Unless it leads, the figure stays ink; the tone shows as this dot and the sparkline. */}
        {tone !== 'neutral' && (
          <span
            className={`seneca-dashboard__stat-dot seneca-dashboard__stat-dot--${tone}`}
            aria-hidden="true"
          />
        )}
        {label}
      </div>
      <Figure
        className={clsx(
          'seneca-dashboard__stat-value',
          lead && tone !== 'neutral' && `seneca-dashboard__stat-value--${tone}`,
          !plainValue && PRIVATE_CLASS,
        )}
      >
        {value}
      </Figure>
      {caption && (
        <div className="seneca-dashboard__stat-row">
          <span className="seneca-dashboard__stat-sub">{caption}</span>
        </div>
      )}
      {note && <div className="seneca-dashboard__stat-note">{note}</div>}
      {details && details.length > 0 && (
        <dl className="seneca-dashboard__stat-details">
          {details.map(detail => (
            <div key={detail.label}>
              <dt>{detail.label}</dt>
              <dd className={detail.plain ? undefined : PRIVATE_CLASS}>{detail.value}</dd>
            </div>
          ))}
        </dl>
      )}
      {chart && <div className="seneca-dashboard__stat-chart">{chart}</div>}
      {meter && <KpiMeter percent={meter.percent} tone={tone} />}
      {/* A line along zero says nothing and reads as an empty axis. */}
      {line && line.points.length >= 2 && line.points.some(point => point !== 0) && (
        <div
          className={clsx(
            'seneca-dashboard__stat-spark',
            tone !== 'neutral' && `seneca-dashboard__stat-spark--${tone}`,
          )}
          aria-hidden="true"
        >
          <Sparkline points={line.points} />
        </div>
      )}
    </>
  );
  if (href) {
    return (
      <Link
        href={href}
        className="seneca-dashboard__stat seneca-dashboard__stat--link"
        data-attention={attentionId}
      >
        {body}
      </Link>
    );
  }
  return (
    <div className="seneca-dashboard__stat" data-attention={attentionId}>
      {body}
    </div>
  );
}
