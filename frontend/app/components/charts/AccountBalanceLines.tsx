'use client';

import type React from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ChartTooltipCard, type ChartTooltipRow } from './ChartParts';
import { formatDayLabel, formatNetAmount, formatShortDayLabel } from './chart-format';
import { CHART_MARGIN, CHART_TICK, GRID_STROKE } from './chart-theme';

/** A chart row: the day and each line's balance, null where it has none. */
export type BalanceRow = { date: string } & Record<string, number | null | string>;

export interface AccountBalanceLinesProps {
  /** One row a day; a line's value is null on a day it has none (after today). */
  rows: BalanceRow[];
  /** The lines shown, each with its key in `rows`, its name and colour. */
  lines: Array<{ key: string; name: string; tone: string }>;
  /** The day the lines end, marked when it falls inside the month. */
  today: string | null;
  locale: string;
  labels: { today: string; total: string };
  formatAmount: (value: number) => string;
}

/**
 * Each account's balance day by day: one calm line per account, ending today,
 * with a faint rule on today. A card's debt runs below zero.
 */
export function AccountBalanceLines({
  rows,
  lines,
  today,
  locale,
  labels,
  formatAmount,
}: AccountBalanceLinesProps): React.JSX.Element {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={rows} margin={{ ...CHART_MARGIN, top: 20 }}>
        <CartesianGrid vertical={false} stroke={GRID_STROKE} />
        <XAxis
          dataKey="date"
          tickFormatter={(key: string) => formatShortDayLabel(key, locale)}
          axisLine={false}
          tickLine={false}
          tick={CHART_TICK}
          interval="preserveStartEnd"
          minTickGap={16}
        />
        <YAxis
          // From zero up, or down to a card's debt.
          domain={[(lowest: number) => Math.min(0, lowest), 'auto']}
          tickFormatter={(value: number) => formatNetAmount(value, formatAmount)}
          axisLine={false}
          tickLine={false}
          tick={CHART_TICK}
          width={64}
        />
        {today && (
          <ReferenceLine
            x={today}
            stroke="var(--text-muted)"
            strokeDasharray="3 3"
            strokeOpacity={0.5}
            label={{
              value: labels.today,
              position: 'top',
              fill: 'var(--text-muted)',
              fontSize: 11,
            }}
          />
        )}
        <Tooltip
          cursor={{ stroke: 'var(--border)', strokeWidth: 1 }}
          content={({ active, payload }) => {
            const row = payload?.[0]?.payload as BalanceRow | undefined;
            if (!(active && row)) {
              return null;
            }
            const known = lines.filter(line => typeof row[line.key] === 'number');
            if (!known.length) {
              return null;
            }
            const rowsOf: ChartTooltipRow[] = known.map(line => ({
              label: line.name,
              value: formatNetAmount(row[line.key] as number, formatAmount),
              color: line.tone,
            }));
            if (known.length > 1) {
              const total = known.reduce((sum, line) => sum + (row[line.key] as number), 0);
              rowsOf.push({
                label: labels.total,
                value: formatNetAmount(total, formatAmount),
                tone: 'strong',
              });
            }
            return <ChartTooltipCard title={formatDayLabel(row.date, locale)} rows={rowsOf} />;
          }}
        />
        {lines.map(line => (
          <Line
            key={line.key}
            type="monotone"
            dataKey={line.key}
            name={line.name}
            stroke={line.tone}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 3 }}
            isAnimationActive={false}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
