'use client';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { PrivateAmount } from '@/app/components/ui/private-amount';
import { useIntlayer } from '@/app/i18n';
import { formatMoney } from '@/app/lib/format-money';
import type { HoldingLots } from '../hooks/useInvestmentTrades';
import { formatUnits } from './trade-labels';

const figureSx = {
  fontWeight: 500,
  fontVariantNumeric: 'tabular-nums',
  fontSize: 15,
} as const;

/** Gains are coloured only when they deviate from zero, and only in the token tones. */
function signedColor(value: number | null): string | undefined {
  if (!value) return undefined;
  return value > 0 ? 'var(--money-up)' : 'var(--money-down)';
}

/**
 * What the trades add up to: units, cost basis, the gain on what is held and
 * on what was sold, dividends and fees, then realised results year by year
 * and the lots still open.
 */
export function HoldingLotsSummary({ lots, locale }: { lots: HoldingLots; locale: string }) {
  const t = useIntlayer('investmentTrades');
  const currency = lots.currency ?? 'USD';
  const money = (value: number) => formatMoney(value, currency, locale);
  const signed = (value: number) =>
    `${value > 0 ? '+' : value < 0 ? '−' : ''}${money(Math.abs(value))}`;
  const figures: Array<{ label: string; value: string; color?: string; private?: boolean }> = [
    { label: t.quantity.value, value: formatUnits(lots.quantity, locale) },
    { label: t.costBasis.value, value: money(lots.costBasis), private: true },
    {
      label: t.averageCost.value,
      value: lots.averageCost === null ? '—' : money(lots.averageCost),
      private: true,
    },
    {
      label: t.marketValue.value,
      value: lots.marketValue === null ? '—' : money(lots.marketValue),
      private: true,
    },
    {
      label: t.unrealizedGain.value,
      value: lots.unrealizedGain === null ? '—' : signed(lots.unrealizedGain),
      color: signedColor(lots.unrealizedGain),
      private: true,
    },
    {
      label: t.realizedGain.value,
      value: signed(lots.realizedGain),
      color: signedColor(lots.realizedGain),
      private: true,
    },
    { label: t.dividends.value, value: money(lots.dividends), private: true },
    { label: t.fees.value, value: money(lots.fees), private: true },
  ];

  return (
    <Box>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(4, 1fr)' },
          gap: 1.5,
        }}
        data-testid="holding-lots-figures"
      >
        {figures.map(figure => (
          <Box key={figure.label}>
            <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: 13 }}>
              {figure.label}
            </Typography>
            <Typography sx={{ ...figureSx, color: figure.color }}>
              {figure.private ? <PrivateAmount>{figure.value}</PrivateAmount> : figure.value}
            </Typography>
          </Box>
        ))}
      </Box>

      {lots.years.length > 0 && (
        <Box sx={{ mt: 2.5 }}>
          <Typography sx={{ fontSize: 15, fontWeight: 500, mb: 0.5 }}>
            {t.realizedByYear}
          </Typography>
          {lots.years.map(year => (
            <Box
              key={year.year}
              sx={{
                display: 'flex',
                gap: 2,
                fontSize: 14,
                py: 0.5,
                borderTop: 1,
                borderColor: 'divider',
              }}
            >
              <Box sx={{ flex: 1 }}>{year.year}</Box>
              <Box sx={{ ...figureSx, fontSize: 14, color: signedColor(year.realizedGain) }}>
                <PrivateAmount>{signed(year.realizedGain)}</PrivateAmount>
              </Box>
              <Box sx={{ color: 'text.secondary' }}>
                {t.dividends}: <PrivateAmount>{money(year.dividends)}</PrivateAmount>
              </Box>
            </Box>
          ))}
        </Box>
      )}

      {lots.openLots.length > 0 && (
        <Box sx={{ mt: 2.5 }}>
          <Typography sx={{ fontSize: 15, fontWeight: 500, mb: 0.5 }}>{t.openLots}</Typography>
          {lots.openLots.map(lot => (
            <Box
              key={`${lot.tradeId}-${lot.acquiredOn}`}
              sx={{
                display: 'flex',
                gap: 2,
                fontSize: 14,
                py: 0.5,
                borderTop: 1,
                borderColor: 'divider',
              }}
            >
              <Box sx={{ flex: 1 }}>{lot.acquiredOn}</Box>
              <Box sx={{ fontVariantNumeric: 'tabular-nums' }}>
                {formatUnits(lot.quantity, locale)}
              </Box>
              <Box sx={{ color: 'text.secondary', fontVariantNumeric: 'tabular-nums' }}>
                × <PrivateAmount>{money(lot.unitCost)}</PrivateAmount>
              </Box>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
}
