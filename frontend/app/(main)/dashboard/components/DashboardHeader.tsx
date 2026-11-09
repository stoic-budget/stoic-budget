'use client';

import type React from 'react';
import { useShownMonth } from '@/app/components/dashboard/use-period-label';
import { PageTitle } from '@/app/components/ui/page-title';
import { DEFAULT_APP_ROUTE } from '@/app/lib/default-app-route';
import { MonthStrip, type MonthStripLabels } from './MonthStrip';
import { PluginShortcuts } from './PluginShortcuts';

export type DashboardHeaderLabels = {
  monthStrip: MonthStripLabels;
};

type DashboardHeaderProps = {
  displayMonth: Date;
  changeMonth: (year: number, month: number) => void;
  locale: string;
  /** "Showing latest available period …" when the backend auto-shifted the window. */
  periodBanner: string | null;
  labels: DashboardHeaderLabels;
};

export function DashboardHeader({
  displayMonth,
  changeMonth,
  locale,
  periodBanner,
  labels,
}: DashboardHeaderProps): React.JSX.Element {
  const monthLabel = useShownMonth(displayMonth).label;
  return (
    <div className="seneca-dashboard-header">
      <div className="seneca-dashboard-header__title">
        <PageTitle path={DEFAULT_APP_ROUTE} summary={monthLabel} />
        <PluginShortcuts />
      </div>
      <div className="seneca-dashboard-header__controls">
        <MonthStrip
          displayMonth={displayMonth}
          onChange={changeMonth}
          locale={locale}
          labels={labels.monthStrip}
        />
        {periodBanner && <div className="seneca-dashboard__period-banner">{periodBanner}</div>}
      </div>
    </div>
  );
}
