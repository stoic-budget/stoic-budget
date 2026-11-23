'use client';

import Typography from '@mui/material/Typography';
import type React from 'react';
import { PrivateAmount } from '@/app/components/ui/private-amount';
import { useIntlayer } from '@/app/i18n';

/**
 * A metal's gain: value less what the priced lots cost. Lots without a
 * purchase price are left out of it, and the line says how many (#655).
 */
export function MetalGain({
  gain,
  unpricedLots,
  known,
  money,
}: {
  gain: number;
  unpricedLots: number;
  /** False when no lot has a price: there is no gain to show, not a zero one. */
  known: boolean;
  money: (value: number) => string;
}): React.ReactElement {
  const t = useIntlayer('netWorthPage');
  return (
    <>
      {known ? (
        <Typography
          variant="body2"
          sx={{ color: gain >= 0 ? 'var(--money-up)' : 'var(--money-down)' }}
        >
          <PrivateAmount>
            {gain >= 0 ? '+' : '−'}
            {money(Math.abs(gain))}
          </PrivateAmount>
        </Typography>
      ) : (
        <Typography variant="body2" sx={{ color: 'var(--text-muted)' }}>
          —
        </Typography>
      )}
      {unpricedLots > 0 ? (
        <Typography variant="body2" sx={{ color: 'var(--text-muted)' }}>
          {t.gainWithoutPrice.value.replace('{{count}}', String(unpricedLots))}
        </Typography>
      ) : null}
    </>
  );
}
