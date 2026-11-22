'use client';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { formatDayLabel } from '@/app/components/charts/chart-format';
import { useIntlayer } from '@/app/i18n';
import type { InvestmentHolding } from '../hooks/useInvestments';
import { isStaleQuote } from './investment-price';

/**
 * What a holding's price should be read with, after the price: a feed that
 * stopped (with the day of its last close), a price typed in, or a quote that
 * has not moved for days. A stopped feed takes an ochre dot: it needs a hand.
 */
export function PriceNote({ holding, locale }: { holding: InvestmentHolding; locale: string }) {
  const t = useIntlayer('netWorthPage');
  const p = useIntlayer('priceHistory');
  const health = holding.priceHealth;
  const stale = health?.status === 'stale';
  const text = stale
    ? health.lastCloseOn
      ? p.noQuotesSince.value.replace('{{date}}', formatDayLabel(health.lastCloseOn, locale))
      : p.noQuotes.value
    : holding.priceSource === 'manual'
      ? t.manualPrice.value
      : isStaleQuote(holding)
        ? t.stalePrice.value
        : null;
  if (!text) return null;
  return (
    <Typography
      component="span"
      variant="caption"
      sx={{ color: 'text.secondary' }}
      data-testid={stale ? 'price-feed-stale' : undefined}
    >
      {' · '}
      {stale && (
        <Box
          component="span"
          aria-hidden
          sx={{
            display: 'inline-block',
            width: 6,
            height: 6,
            borderRadius: '50%',
            bgcolor: 'var(--attention)',
            mr: 0.5,
            verticalAlign: 'middle',
          }}
        />
      )}
      {text}
    </Typography>
  );
}
