'use client';

import Box from '@mui/material/Box';
import MuiLink from '@mui/material/Link';
import Skeleton from '@mui/material/Skeleton';
import Typography from '@mui/material/Typography';
import NextLink from 'next/link';
import { useState } from 'react';
import { LoadError } from '@/app/components/ui/load-error';
import { useIntlayer, useLocale } from '@/app/i18n';
import { formatMoney } from '@/app/lib/format-money';
import { resolveLocaleTag } from '@/app/lib/user-format';
import { type PaycheckPlanResponse, usePaycheckPlan } from '../hooks/usePaycheckPlan';
import { FORECAST_CARD_SX } from './ForecastKpi';
import { fill } from './ForecastUpcomingHeader';
import { PaycheckControls } from './PaycheckControls';
import { PaycheckPeriodRow } from './PaycheckPeriodRow';

const MONTH_SETTING_HREF = '/settings/profile?tab=data&section=month-start';

/**
 * Payday to payday: for the current period and the next ones, what arrives,
 * which bills and subscriptions fall due before the next payday, and what is
 * safe to spend in all and per day.
 */
export function PaycheckPlanner() {
  const t = useIntlayer('paycheckPlanner');
  const { locale } = useLocale();
  const plan = usePaycheckPlan();
  // The current period starts open; a click opens or closes one at a time.
  const [openStart, setOpenStart] = useState<string | null | undefined>(undefined);

  if (plan.isError && !plan.data) {
    return <LoadError spacing={2}>{t.error}</LoadError>;
  }
  const { data } = plan;
  const formatAmount = (value: number) =>
    formatMoney(
      value,
      data?.currency ?? 'USD',
      locale,
      Number.isInteger(value) ? { fractionDigits: 0 } : {},
    );
  const opened = openStart === undefined ? data?.periods[0]?.start : openStart;

  return (
    <Box
      component="section"
      aria-labelledby="paycheck-planner-title"
      sx={{
        ...FORECAST_CARD_SX,
        opacity: plan.isFetching && data ? 0.6 : 1,
        transition: 'opacity 150ms ease',
      }}
    >
      <Typography id="paycheck-planner-title" component="h2" sx={{ fontSize: 15, fontWeight: 500 }}>
        {t.title}
      </Typography>
      <Typography sx={{ fontSize: 13, color: 'text.secondary', mb: 2 }}>{t.description}</Typography>

      {!data ? (
        <Box sx={{ display: 'grid', gap: 1 }}>
          {[0, 1, 2].map(row => (
            <Skeleton key={row} variant="rounded" height={48} />
          ))}
        </Box>
      ) : (
        <>
          <PaycheckControls
            data={data}
            buffer={plan.buffer}
            onToggleStream={plan.toggleStream}
            onToggleWallet={plan.toggleWallet}
            onBuffer={plan.setBuffer}
          />
          <BasisNote data={data} />
          <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0 }}>
            {data.periods.map((period, index) => (
              <PaycheckPeriodRow
                key={period.start}
                period={period}
                isCurrent={index === 0}
                expanded={opened === period.start}
                onToggle={() => setOpenStart(opened === period.start ? null : period.start)}
                buffer={data.buffer}
                formatAmount={formatAmount}
              />
            ))}
          </Box>
          <Typography sx={{ fontSize: 13, color: 'text.secondary', mt: 1 }}>
            {t.projectionNote}
            {data.rates.length > 0 &&
              ` ${fill(t.ratesNote.value, { rates: ratesText(data, locale, t.noRate.value) })}`}
          </Typography>
        </>
      )}
    </Box>
  );
}

/** Why the periods are months rather than paydays, with the way to change it. */
function BasisNote({ data }: { data: PaycheckPlanResponse }) {
  const t = useIntlayer('paycheckPlanner');
  if (data.basis === 'paydays') return null;
  const reason =
    data.incomeStatus === 'none'
      ? t.noIncome
      : data.incomeStatus === 'irregular' && data.streams.length === 0
        ? t.irregularIncome
        : t.noStreamChosen;
  return (
    <Typography sx={{ fontSize: 13, color: 'text.secondary', mb: 1.5 }}>
      {reason}{' '}
      <MuiLink component={NextLink} href={MONTH_SETTING_HREF}>
        {t.monthSettingLink}
      </MuiLink>
    </Typography>
  );
}

/** "1 EUR = 1.08 USD (9 Nov)" for each rate used; a missing one says it was counted 1:1. */
function ratesText(data: PaycheckPlanResponse, locale: string, noRate: string): string {
  const number = new Intl.NumberFormat(resolveLocaleTag(locale), { maximumFractionDigits: 6 });
  return data.rates
    .map(rate =>
      rate.rate === null
        ? fill(noRate, { currency: rate.currency })
        : `1 ${rate.currency} = ${number.format(rate.rate)} ${data.currency}${
            rate.rateDate && rate.rateDate !== data.today ? ` (${rate.rateDate})` : ''
          }`,
    )
    .join(', ');
}
