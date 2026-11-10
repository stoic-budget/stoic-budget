'use client';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { formatDayLabel } from '@/app/components/charts/chart-format';
import { LazyNetWorthArea, LazyReturnsArea } from '@/app/components/charts/lazy-charts';
import { useIntlayer } from '@/app/i18n';
import { formatMoney } from '@/app/lib/format-money';
import type { InvestmentHolding } from '../hooks/useInvestments';
import { type PriceHealth, usePriceHistory } from '../hooks/usePriceHistory';
import { HoldingCloses } from './HoldingCloses';

/** How the feed is doing, in one line; a stopped feed says what to do about it. */
function HealthLine({ health, locale }: { health: PriceHealth | null; locale: string }) {
  const p = useIntlayer('priceHistory');
  if (!health) return null;
  const day = health.lastCloseOn ? formatDayLabel(health.lastCloseOn, locale) : '';
  if (health.status === 'stale') {
    return (
      <Box data-testid="price-health" sx={{ fontSize: 14 }}>
        <Box
          component="span"
          aria-hidden
          sx={{
            display: 'inline-block',
            width: 6,
            height: 6,
            borderRadius: '50%',
            bgcolor: 'var(--attention)',
            mr: 0.75,
            verticalAlign: 'middle',
          }}
        />
        {day ? p.stale.value.replace('{{date}}', day) : p.staleNever}
        <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: 13 }}>
          {p.staleHint}
        </Typography>
      </Box>
    );
  }
  return (
    <Typography
      data-testid="price-health"
      variant="body2"
      sx={{ color: 'text.secondary', fontSize: 13 }}
    >
      {health.status === 'pending' ? p.pending : p.lastClose.value.replace('{{date}}', day)}
    </Typography>
  );
}

/**
 * A holding over time. With trades: its value against what it cost, the gap
 * being the gain not yet realised. Without: the closes alone, since nobody
 * recorded how much was held back then. Then the closes the workspace keeps.
 */
export function HoldingPriceHistory({
  holding,
  locale,
}: {
  holding: InvestmentHolding;
  locale: string;
}) {
  const p = useIntlayer('priceHistory');
  const data = usePriceHistory(holding.id, Boolean(holding.symbol));
  const history = data.history;
  const currency = history?.currency ?? holding.priceCurrency;
  const money = (value: number) => formatMoney(value, currency, locale);
  const points = history?.points ?? [];
  const valued = points.flatMap(point =>
    point.value !== null && point.costBasis !== null
      ? [{ date: point.date, value: point.value, netContributed: point.costBasis }]
      : [],
  );
  const closes = points.flatMap(point =>
    point.close !== null ? [{ date: point.date, value: point.close }] : [],
  );
  const last = valued[valued.length - 1];

  return (
    <Box sx={{ display: 'grid', gap: 1.5, minWidth: 0 }} data-testid="holding-price-history">
      <Box>
        <Typography sx={{ fontSize: 15, fontWeight: 500 }}>{p.historyTitle}</Typography>
        {holding.symbol ? (
          <HealthLine health={history?.health ?? holding.priceHealth} locale={locale} />
        ) : (
          <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: 13 }}>
            {p.noSymbol}
          </Typography>
        )}
      </Box>
      {history?.basis === 'trades' && valued.length > 1 && (
        <Box sx={{ height: 220 }} data-testid="holding-value-chart">
          <LazyReturnsArea
            points={valued}
            positive={(last?.value ?? 0) >= (last?.netContributed ?? 0)}
            locale={locale}
            formatValue={money}
            labels={{
              value: p.value.value,
              netContributed: p.costBasis.value,
              gain: p.unrealizedGain.value,
            }}
          />
        </Box>
      )}
      {history?.basis === 'none' && closes.length > 1 && (
        <>
          <Box sx={{ height: 180 }} data-testid="holding-close-chart">
            <LazyNetWorthArea
              points={closes}
              positive={closes[closes.length - 1].value >= closes[0].value}
              locale={locale}
              formatValue={money}
            />
          </Box>
          <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: 13 }}>
            {p.needsTrades}
          </Typography>
        </>
      )}
      {holding.symbol && (
        <HoldingCloses
          closes={data.closes}
          currency={holding.priceCurrency}
          locale={locale}
          saving={data.saving}
          onAdd={data.addClose}
          onDelete={data.deleteClose}
          onImport={data.importCloses}
        />
      )}
    </Box>
  );
}
