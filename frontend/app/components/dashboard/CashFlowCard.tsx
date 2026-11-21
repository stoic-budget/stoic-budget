'use client';

import BarChartOutlined from '@mui/icons-material/BarChartOutlined';
import type React from 'react';
import { useLayoutEffect, useMemo, useState } from 'react';
import { formatMonthLabel, formatNetAmount } from '@/app/components/charts/chart-format';
import { PRIVATE_CLASS, PrivateAmount } from '@/app/components/ui/private-amount';
import { TextTabs } from '@/app/components/ui/text-tabs';
import {
  type DashboardCashFlowEntry,
  type DashboardCashFlowPoint,
  useCashFlowEntries,
} from '@/app/hooks/useDashboard';
import { useIntlayer, useLocale } from '@/app/i18n';
import { AccountBalancesView } from './AccountBalancesView';
import { CashFlowCalendar } from './CashFlowCalendar';
import { CashFlowFlow } from './CashFlowFlow';
import { monthRange } from './cash-flow-flow';
import { CardEmpty, CardLink, DashboardCard, Figure } from './ui';

interface CashFlowCardProps {
  formatAmount: (value: number) => string;
  /** The dashboard's picked month (YYYY-MM): the card shows it day by day. */
  activeMonth: string;
  /** That month's days, from the dashboard answer (zero-filled, one point a day). */
  days: DashboardCashFlowPoint[];
}

/** The app's phone layout (no sidebar). */
const PHONE_QUERY = '(max-width: 1023px)';

function isPhoneNow(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia(PHONE_QUERY).matches;
}

type CashFlowView = 'chart' | 'calendar' | 'flow';

const VIEWS: CashFlowView[] = ['chart', 'calendar', 'flow'];

/** Which view this reader left the card in; a convenience of this browser only. */
const VIEW_KEY = 'seneca.cashFlowView';

/** The saved view, else what fits the screen: a phone opens on the calendar, a wider screen on the flow. */
function readView(): CashFlowView {
  const fallback: CashFlowView = isPhoneNow() ? 'calendar' : 'flow';
  try {
    const saved = window.localStorage.getItem(VIEW_KEY);
    return VIEWS.find(view => view === saved) ?? fallback;
  } catch {
    return fallback;
  }
}

function storeView(view: CashFlowView): void {
  try {
    window.localStorage.setItem(VIEW_KEY, view);
  } catch {
    // Storage blocked: the view just is not remembered.
  }
}

/** Reports → Cash flow opened on the same month. */
export function reportsHref(month: string): string {
  const { from, to } = monthRange(month);
  return `/reports?tab=cash-flow&from=${from}&to=${to}`;
}

export function CashFlowCard({
  formatAmount,
  activeMonth,
  days,
}: CashFlowCardProps): React.JSX.Element {
  const t = useIntlayer('cashFlowCard');
  const overview = useIntlayer('overviewTab');
  const { locale } = useLocale();
  const income = days.reduce((sum, day) => sum + day.income, 0);
  const expense = days.reduce((sum, day) => sum + day.expense, 0);
  const budgeted = days.reduce((sum, day) => sum + day.budgeted, 0);
  const hasMoney = days.some(day => day.income !== 0 || day.expense !== 0);
  // The chart first, as the server drew it; the real view before the first paint, so hydration matches.
  const [view, setView] = useState<CashFlowView>('chart');
  useLayoutEffect(() => setView(readView()), []);
  const changeView = (next: CashFlowView) => {
    setView(next);
    storeView(next);
  };
  const entries = useCashFlowEntries(activeMonth);
  // A calendar day lists what made it, so the rows are grouped by day once.
  const entriesByDay = useMemo(() => {
    if (!entries) {
      return undefined;
    }
    const byDay = new Map<string, DashboardCashFlowEntry[]>();
    for (const entry of entries) {
      byDay.set(entry.date, [...(byDay.get(entry.date) ?? []), entry]);
    }
    return byDay;
  }, [entries]);

  return (
    <DashboardCard
      title={t.title}
      subtitle={formatMonthLabel(activeMonth, locale)}
      className="seneca-dashboard__cashflow-card"
      action={
        <>
          <TextTabs<CashFlowView>
            value={view}
            onChange={changeView}
            options={[
              { value: 'chart', label: t.viewChart.value },
              { value: 'calendar', label: t.viewCalendar.value },
              { value: 'flow', label: t.viewFlow.value },
            ]}
            ariaLabel={t.viewLabel.value}
          />
          {/* The flow is a preview of the Reports one; its filters and detail live there. */}
          {view === 'flow' && (
            <CardLink href={reportsHref(activeMonth)}>{overview.viewAll}</CardLink>
          )}
          {view === 'chart' && <CardLink href="/accounts">{overview.viewAll}</CardLink>}
        </>
      }
    >
      {view === 'chart' ? (
        <AccountBalancesView month={activeMonth} formatAmount={formatAmount} />
      ) : (
        <>
          <Figure className={`seneca-chart__total ${PRIVATE_CLASS}`}>
            {formatNetAmount(income - expense, formatAmount)}
          </Figure>
          <div className="seneca-chart__breakdown">
            <span className="seneca-chart__breakdown-series seneca-chart__breakdown-series--income">
              {t.income.value} <PrivateAmount>{formatAmount(income)}</PrivateAmount>
            </span>
            <span className="seneca-chart__breakdown-series seneca-chart__breakdown-series--expense">
              {t.expense.value} <PrivateAmount>{formatAmount(expense)}</PrivateAmount>
            </span>
            {budgeted > 0 && (
              <span className="seneca-chart__breakdown-series seneca-chart__breakdown-series--budgeted">
                {t.budgeted.value} <PrivateAmount>{formatAmount(budgeted)}</PrivateAmount>
              </span>
            )}
          </div>
          {!hasMoney ? (
            <div className="seneca-chart__box">
              <CardEmpty icon={BarChartOutlined} fill>
                {t.empty}
              </CardEmpty>
            </div>
          ) : view === 'calendar' ? (
            <CashFlowCalendar days={days} entriesByDay={entriesByDay} formatAmount={formatAmount} />
          ) : (
            <CashFlowFlow month={activeMonth} formatAmount={formatAmount} />
          )}
        </>
      )}
    </DashboardCard>
  );
}
