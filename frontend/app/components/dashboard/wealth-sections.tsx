import type React from 'react';
import { BalancesCard } from './BalancesCard';
import { DataCoverageCard } from './DataCoverageCard';
import { NetWorthCard } from './NetWorthCard';

/**
 * The Overview's two views of what is owned and owed, and how far the bank
 * statements behind them reach, keyed by section id.
 */
export function wealthSections(
  month: string,
  monthLabel: string,
): Record<'net-worth' | 'balances' | 'data-sources', React.ReactNode> {
  return {
    'net-worth': <NetWorthCard month={month} monthLabel={monthLabel} />,
    balances: <BalancesCard month={month} monthLabel={monthLabel} />,
    'data-sources': <DataCoverageCard />,
  };
}
