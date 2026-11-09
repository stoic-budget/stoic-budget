'use client';

import type React from 'react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ChartTooltipCard, type ChartTooltipRow } from './ChartParts';
import { computeYearTicks, formatDayLabel } from './chart-format';
import { CHART_MARGIN, CHART_TICK, LEGEND_STYLE } from './chart-theme';

export interface LoanBalancePoint {
  /** YYYY-MM-DD */
  date: string;
  planned: number | null;
  actual: number | null;
  projected: number | null;
}

export interface LoanBalanceLinesProps {
  points: LoanBalancePoint[];
  labels: { planned: string; actual: string; projected: string };
  locale: string;
  formatValue: (value: number) => string;
  formatTick: (value: number) => string;
}

/** What a loan owes over time: the plan (dashed grey), the real balance (sage) and the forecast from it. */
export function LoanBalanceLines({
  points,
  labels,
  locale,
  formatValue,
  formatTick,
}: LoanBalanceLinesProps): React.JSX.Element {
  const yearTicks = computeYearTicks(points.map(point => point.date));
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={points} margin={CHART_MARGIN}>
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis
          dataKey="date"
          ticks={yearTicks}
          tickFormatter={(key: string) => key.slice(0, 4)}
          axisLine={false}
          tickLine={false}
          tick={CHART_TICK}
          interval="preserveStartEnd"
        />
        <YAxis
          axisLine={false}
          tickLine={false}
          tick={CHART_TICK}
          tickFormatter={formatTick}
          width={56}
          domain={[0, 'auto']}
        />
        <Tooltip
          cursor={{ stroke: 'var(--border)', strokeWidth: 1 }}
          content={({ active, payload }) => {
            const point = payload?.[0]?.payload as LoanBalancePoint | undefined;
            if (!(active && point)) {
              return null;
            }
            const rows: ChartTooltipRow[] = [];
            if (point.actual !== null) {
              rows.push({ label: labels.actual, value: formatValue(point.actual), tone: 'strong' });
            }
            if (point.projected !== null && point.actual === null) {
              rows.push({ label: labels.projected, value: formatValue(point.projected) });
            }
            if (point.planned !== null) {
              rows.push({ label: labels.planned, value: formatValue(point.planned) });
            }
            return <ChartTooltipCard title={formatDayLabel(point.date, locale)} rows={rows} />;
          }}
        />
        <Legend verticalAlign="top" height={24} wrapperStyle={LEGEND_STYLE} />
        <Line
          type="monotone"
          dataKey="planned"
          name={labels.planned}
          stroke="var(--cat-tone-other)"
          strokeWidth={2}
          strokeDasharray="4 4"
          dot={false}
          connectNulls
          isAnimationActive={false}
        />
        <Line
          type="monotone"
          dataKey="actual"
          name={labels.actual}
          stroke="var(--primary)"
          strokeWidth={2}
          dot={false}
          connectNulls
          isAnimationActive={false}
        />
        <Line
          type="monotone"
          dataKey="projected"
          name={labels.projected}
          stroke="var(--cat-tone-4)"
          strokeWidth={2}
          strokeDasharray="2 3"
          dot={false}
          connectNulls
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
