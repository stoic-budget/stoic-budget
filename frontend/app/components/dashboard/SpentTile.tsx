'use client';

import Skeleton from '@mui/material/Skeleton';
import type React from 'react';
import { budgetTone, useBudgets } from '@/app/(main)/dashboard/components/BudgetSummaryWidget';
import { useLocale } from '@/app/i18n';
import { formatMoney } from '@/app/lib/format-money';
import { leftToSpend } from './left-to-spend';
import { KpiCard, type KpiCardProps } from './ui';

interface SpentTileProps extends KpiCardProps {
  /** The month shown, `YYYY-MM`. */
  month: string;
  leftLabel: string;
  /** What was spent, kept as a detail once the tile shows what is left. */
  spentValue: string;
}

const BUDGET_TONE: Record<ReturnType<typeof budgetTone>, KpiCardProps['tone']> = {
  calm: 'neutral',
  near: 'warning',
  over: 'negative',
};

/** How much of a currency's budgets is used, in percent; spending with nothing allowed is over. */
function percentUsed({ amount, allowed }: { amount: number; allowed: number }): number {
  if (allowed > 0) {
    return ((allowed - amount) / allowed) * 100;
  }
  return amount < 0 ? Number.POSITIVE_INFINITY : 0;
}

/**
 * What was spent, until a budget covers the month: from then on what the
 * budgets still allow, with a bar of how much of them is used. A budget that
 * starts after the month or ended before it does not count.
 */
export function SpentTile({
  month,
  leftLabel,
  spentValue,
  ...spent
}: SpentTileProps): React.JSX.Element {
  const { locale } = useLocale();
  const { budgets, loaded } = useBudgets(month);
  // Until the budgets are in it is not known which of the two the tile is.
  if (!loaded) {
    return <KpiCard {...spent} value={<Skeleton variant="text" width={120} />} />;
  }
  const left = leftToSpend(budgets, month);
  if (!left) {
    return <KpiCard {...spent} />;
  }
  // With several currencies the bar shows the one closest to its limit.
  const used = Math.max(...left.map(percentUsed));
  return (
    <KpiCard
      {...spent}
      label={leftLabel}
      value={left.map(total => formatMoney(total.amount, total.currency, locale)).join(' · ')}
      // The same thresholds as the budgets card: ochre in the last tenth, terracotta past the limit.
      tone={BUDGET_TONE[budgetTone(used)]}
      meter={{ percent: used }}
      details={[{ label: spent.label, value: spentValue }, ...(spent.details ?? [])]}
    />
  );
}
