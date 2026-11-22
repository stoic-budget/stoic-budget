'use client';

import type React from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { ChartTooltipCard } from './ChartParts';

export interface NestedSlice {
  key: string;
  name: string;
  value: number;
  percent: number;
  color: string;
  /** Lighter shades of the parent's tone tell the children apart. */
  opacity?: number;
}

export interface NestedDonutProps {
  /** The inner ring: the groups. */
  inner: NestedSlice[];
  /** The outer ring, in the same order as the groups it splits. */
  outer: NestedSlice[];
  formatAmount: (value: number) => string;
  /** Privacy mode: the tooltip names the slice and keeps its sum and share to itself. */
  quiet?: boolean;
}

/**
 * Two rings: the groups inside, what each is made of around it. Colours are
 * the chart tone variables, so the theme switch repaints it without a render.
 */
export function NestedDonut({
  inner,
  outer,
  formatAmount,
  quiet = false,
}: NestedDonutProps): React.JSX.Element {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Tooltip
          allowEscapeViewBox={{ x: true, y: true }}
          content={({ active, payload }) => {
            const slice = payload?.[0]?.payload as NestedSlice | undefined;
            if (!(active && slice)) return null;
            return (
              <ChartTooltipCard
                title={slice.name}
                color={slice.color}
                rows={
                  quiet
                    ? []
                    : [
                        {
                          value: `${formatAmount(slice.value)} · ${slice.percent}%`,
                          tone: 'strong',
                        },
                      ]
                }
              />
            );
          }}
        />
        <Pie
          data={inner}
          dataKey="value"
          nameKey="name"
          innerRadius="34%"
          outerRadius="62%"
          stroke="var(--card)"
          strokeWidth={2}
          isAnimationActive={false}
        >
          {inner.map(slice => (
            <Cell key={slice.key} fill={slice.color} />
          ))}
        </Pie>
        <Pie
          data={outer}
          dataKey="value"
          nameKey="name"
          innerRadius="66%"
          outerRadius="92%"
          stroke="var(--card)"
          strokeWidth={2}
          isAnimationActive={false}
        >
          {outer.map(slice => (
            <Cell key={slice.key} fill={slice.color} fillOpacity={slice.opacity ?? 1} />
          ))}
        </Pie>
      </PieChart>
    </ResponsiveContainer>
  );
}
