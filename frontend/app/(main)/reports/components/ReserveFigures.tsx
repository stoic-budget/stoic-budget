'use client';

import { Box, Stack, Typography } from '@mui/material';
import type React from 'react';
import { PRIVATE_CLASS } from '@/app/components/ui/private-amount';
import { useIntlayer } from '@/app/i18n';
import type { TaxReserve } from '@/app/lib/contracts';

function fill(template: string, params: Record<string, string | number>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => String(params[key] ?? ''));
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <Box sx={{ flex: { xs: '1 1 140px', md: '0 0 auto' }, minWidth: { md: 170 } }}>
      <Typography sx={{ fontSize: 14, color: 'var(--text-muted)' }}>{label}</Typography>
      <Typography
        className={PRIVATE_CLASS}
        sx={{
          mt: 0.5,
          fontSize: 28,
          fontWeight: 500,
          lineHeight: 1.2,
          fontVariantNumeric: 'tabular-nums',
          color: 'text.primary',
        }}
      >
        {value}
      </Typography>
    </Box>
  );
}

/**
 * What the reserve is made of: the total to hold back, the year's VAT and
 * share of earnings, what last year left unpaid, and what was paid this year.
 */
export function ReserveFigures({
  reserve,
  money,
}: {
  reserve: TaxReserve;
  money: (value: number, currency: string) => string;
}): React.ReactElement {
  const t = useIntlayer('taxYearView');
  return (
    <Stack direction="row" sx={{ flexWrap: 'wrap', columnGap: 3, rowGap: 2 }}>
      <Figure label={t.reserveTotal.value} value={money(reserve.total, reserve.currency)} />
      {reserve.vat ? (
        // Paid more VAT than collected: that is money back, said in words, not a bare minus.
        <Figure
          label={reserve.vat.net < 0 ? t.reserveVatReclaim.value : t.reserveVat.value}
          value={money(Math.abs(reserve.vat.net), reserve.currency)}
        />
      ) : null}
      {reserve.incomeTax ? (
        <Figure
          label={fill(t.reserveIncomeTax.value, { percent: reserve.incomeTax.percent })}
          value={money(reserve.incomeTax.amount, reserve.currency)}
        />
      ) : null}
      {reserve.carriedOver > 0 ? (
        <Figure
          label={t.reserveCarried.value}
          value={money(reserve.carriedOver, reserve.currency)}
        />
      ) : null}
      {/* Subtracted from the total, so a minus — but never on a zero. */}
      <Figure
        label={fill(t.reservePaid.value, { count: reserve.payments.count })}
        value={money(-reserve.payments.amount, reserve.currency)}
      />
    </Stack>
  );
}
