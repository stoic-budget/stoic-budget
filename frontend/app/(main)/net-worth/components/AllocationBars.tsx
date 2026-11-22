'use client';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import type React from 'react';
import { OTHER_TONE } from '@/app/components/charts/chart-theme';
import { PrivateAmount } from '@/app/components/ui/private-amount';
import { WholeMoney } from './net-worth-ui';

export interface BarItem {
  key: string;
  label: string;
  amount: number;
  percent: number;
}

const REST = new Set(['other', 'unclassified']);

/** One cut as bars: the largest first, the unnamed rest in the grey the charts keep for it. */
export function AllocationBars({
  items,
  currency,
  locale,
}: {
  items: BarItem[];
  currency: string;
  locale: string;
}): React.JSX.Element {
  const largest = Math.max(...items.map(item => item.percent), 1);
  return (
    <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0, display: 'grid', gap: 1.25 }}>
      {items.map(item => (
        <Box
          component="li"
          key={item.key}
          data-testid={`allocation-bar-${item.key}`}
          sx={{
            display: 'grid',
            // Fixed figure columns, so every bar's track starts and ends in the same place.
            gridTemplateColumns: { xs: '1fr auto', sm: 'minmax(120px, 200px) 1fr 64px 96px' },
            alignItems: 'center',
            columnGap: 1.5,
            rowGap: 0.5,
          }}
        >
          <Typography variant="body2" noWrap sx={{ minWidth: 0 }} title={item.label}>
            {item.label}
          </Typography>
          <Box
            sx={{
              gridColumn: { xs: '1 / -1', sm: 'auto' },
              gridRow: { xs: 2, sm: 'auto' },
              height: 6,
              borderRadius: 3,
              bgcolor: 'var(--surface-soft)',
              overflow: 'hidden',
            }}
          >
            <Box
              sx={{
                width: `${(item.percent / largest) * 100}%`,
                height: '100%',
                borderRadius: 3,
                bgcolor: REST.has(item.key) ? OTHER_TONE : 'var(--cat-tone-1)',
              }}
            />
          </Box>
          <Typography
            variant="body2"
            sx={{
              color: 'text.secondary',
              fontVariantNumeric: 'tabular-nums',
              display: { xs: 'none', sm: 'block' },
            }}
          >
            <PrivateAmount>{item.percent}%</PrivateAmount>
          </Typography>
          <Typography
            variant="body2"
            sx={{ fontWeight: 500, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}
          >
            <WholeMoney value={item.amount} currency={currency} locale={locale} />
          </Typography>
        </Box>
      ))}
    </Box>
  );
}
