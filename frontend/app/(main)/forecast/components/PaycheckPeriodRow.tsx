'use client';

import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Typography from '@mui/material/Typography';
import { PRIVATE_CLASS, PrivateAmount } from '@/app/components/ui/private-amount';
import { useIntlayer } from '@/app/i18n';
import { formatStoredDateWithOptions } from '@/app/lib/user-format-store';
import type { PaycheckItem, PaycheckPeriod } from '../hooks/usePaycheckPlan';
import { fill } from './ForecastUpcomingHeader';

const shortDate = (date: string): string =>
  formatStoredDateWithOptions(date, { day: 'numeric', month: 'short' });

const KIND_KEYS = {
  income: 'kindIncome',
  payable: 'kindPayable',
  subscription: 'kindSubscription',
  goal: 'kindGoal',
  tax: 'heldForTax',
} as const satisfies Record<PaycheckItem['kind'], string>;

interface PaycheckPeriodRowProps {
  period: PaycheckPeriod;
  isCurrent: boolean;
  expanded: boolean;
  onToggle: () => void;
  buffer: number;
  formatAmount: (value: number) => string;
}

/**
 * One period between paydays: dates and safe to spend on a line that opens
 * onto what arrives and what is due, and how the figure is made.
 */
export function PaycheckPeriodRow({
  period,
  isCurrent,
  expanded,
  onToggle,
  buffer,
  formatAmount,
}: PaycheckPeriodRowProps) {
  const t = useIntlayer('paycheckPlanner');
  const kinds = useIntlayer('forecastPage');
  const short = period.safeToSpend < 0;
  const bodyId = `paycheck-period-${period.start}`;
  const range = `${isCurrent ? t.now.value : shortDate(period.start)} – ${shortDate(period.end)}`;
  const ends = period.nextPayday
    ? fill(t.nextPayday.value, { date: shortDate(period.nextPayday) })
    : fill(t.monthEnds.value, { date: shortDate(period.end) });

  return (
    <Box component="li" sx={{ borderTop: '1px solid', borderColor: 'divider' }}>
      <ButtonBase
        onClick={onToggle}
        aria-expanded={expanded}
        aria-controls={bodyId}
        sx={{
          width: '100%',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 2,
          py: 1.5,
          textAlign: 'left',
          borderRadius: 1,
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontSize: 14, fontWeight: 500 }}>{range}</Typography>
          <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>
            {ends}
            {' · '}
            {fill(t.daysLeft.value, { days: String(period.daysLeft) })}
          </Typography>
        </Box>
        <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
          <Typography
            sx={{
              fontSize: 15,
              fontWeight: 500,
              fontVariantNumeric: 'tabular-nums',
              color: short ? 'var(--money-down)' : 'text.primary',
            }}
          >
            <PrivateAmount>
              {short
                ? fill(t.shortBy.value, { amount: formatAmount(-period.safeToSpend) })
                : formatAmount(period.safeToSpend)}
            </PrivateAmount>
          </Typography>
          <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>
            {short ? (
              t.safeToSpend
            ) : (
              <PrivateAmount>
                {fill(t.perDay.value, { amount: formatAmount(period.safeToSpendPerDay) })}
              </PrivateAmount>
            )}
          </Typography>
        </Box>
      </ButtonBase>

      {expanded && (
        <Box id={bodyId} sx={{ pb: 2, display: 'grid', gap: 1.5 }}>
          {period.items.length === 0 ? (
            <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>{t.nothingDue}</Typography>
          ) : (
            <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0, display: 'grid', gap: 0.5 }}>
              {period.items.map(item => (
                <Box
                  component="li"
                  key={`${item.kind}:${item.sourceId}:${item.date}`}
                  sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}
                >
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontSize: 14 }} noWrap>
                      {item.kind === 'tax' ? kinds.heldForTax : item.label}
                    </Typography>
                    <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>
                      {shortDate(item.date)}
                      {' · '}
                      {kinds[KIND_KEYS[item.kind]]}
                      {item.isOverdue && (
                        <Box component="span" sx={{ color: 'var(--attention)' }}>
                          {' · '}
                          {item.kind === 'income' ? t.late : kinds.overdue}
                        </Box>
                      )}
                    </Typography>
                  </Box>
                  <Typography
                    className={PRIVATE_CLASS}
                    sx={{
                      fontSize: 14,
                      fontWeight: 500,
                      fontVariantNumeric: 'tabular-nums',
                      color: item.amount > 0 ? 'var(--money-up)' : 'text.primary',
                    }}
                  >
                    {item.amount > 0 ? '+' : '−'}
                    {formatAmount(Math.abs(item.amount))}
                  </Typography>
                </Box>
              ))}
            </Box>
          )}
          <Box
            component="dl"
            sx={{
              m: 0,
              pt: 1,
              borderTop: '1px dashed',
              borderColor: 'divider',
              display: 'grid',
              gridTemplateColumns: '1fr auto',
              columnGap: 2,
              rowGap: 0.25,
              fontSize: 13,
              '& dt': { color: 'text.secondary' },
              '& dd': { m: 0, textAlign: 'right', fontVariantNumeric: 'tabular-nums' },
            }}
          >
            <dt>{period.startingCashProjected ? t.startingCashProjected : t.startingCash}</dt>
            <dd className={PRIVATE_CLASS}>{formatAmount(period.startingCash)}</dd>
            <dt>{t.income}</dt>
            <dd className={PRIVATE_CLASS}>+{formatAmount(period.income)}</dd>
            <dt>{t.commitments}</dt>
            <dd className={PRIVATE_CLASS}>−{formatAmount(period.commitments)}</dd>
            {buffer > 0 && (
              <>
                <dt>{t.kept}</dt>
                <dd className={PRIVATE_CLASS}>−{formatAmount(buffer)}</dd>
              </>
            )}
          </Box>
          {/* Safe to spend is read at the lowest point: a bill before the money lowers it. */}
          {Math.abs(
            period.startingCash + period.income - period.commitments - buffer - period.safeToSpend,
          ) > 0.01 && (
            <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>{t.timingNote}</Typography>
          )}
        </Box>
      )}
    </Box>
  );
}
