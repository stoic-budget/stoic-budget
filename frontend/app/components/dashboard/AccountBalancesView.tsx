'use client';

import AccountBalanceWalletOutlined from '@mui/icons-material/AccountBalanceWalletOutlined';
import Skeleton from '@mui/material/Skeleton';
import type React from 'react';
import { useState } from 'react';
import { formatNetAmount } from '@/app/components/charts/chart-format';
import { categoryTones } from '@/app/components/charts/chart-theme';
import { LazyAccountBalanceLines } from '@/app/components/charts/lazy-charts';
import { PRIVATE_CLASS, PrivateAmount } from '@/app/components/ui/private-amount';
import { useAccountBalanceDays } from '@/app/hooks/useDashboard';
import { useIntlayer, useLocale } from '@/app/i18n';
import { balanceLines, balanceRows, latestBalances, todayKey } from './account-balance-lines';
import { CardEmpty, Figure } from './ui';

interface AccountBalancesViewProps {
  /** The dashboard's picked month, YYYY-MM. */
  month: string;
  formatAmount: (value: number) => string;
}

/**
 * The cash flow card's Accounts view: what each everyday account held day by
 * day through the month, one line each, ending today. The legend names each
 * account with its balance and hides or shows its line.
 */
export function AccountBalancesView({
  month,
  formatAmount,
}: AccountBalancesViewProps): React.JSX.Element {
  const t = useIntlayer('cashFlowCard');
  const { locale } = useLocale();
  const { data, isError } = useAccountBalanceDays(month);
  const [hidden, setHidden] = useState<ReadonlySet<string>>(() => new Set());

  if (!data) {
    return (
      <div className="seneca-chart__box">
        {isError ? (
          <CardEmpty icon={AccountBalanceWalletOutlined} fill>
            {t.empty}
          </CardEmpty>
        ) : (
          <Skeleton variant="rounded" width="100%" height="100%" />
        )}
      </div>
    );
  }
  if (data.accounts.length === 0) {
    return (
      <div className="seneca-chart__box">
        <CardEmpty icon={AccountBalanceWalletOutlined} fill>
          {t.accountsEmpty}
        </CardEmpty>
      </div>
    );
  }

  const today = todayKey();
  const lines = balanceLines(data, today, t.other.value);
  const tones = categoryTones(lines.map(line => ({ key: line.key, isOther: line.isOther })));
  const rows = balanceRows(data.days, lines, today);
  const latest = latestBalances(rows, lines);
  const shown = lines.filter(line => !hidden.has(line.key));
  const total = shown.reduce((sum, line) => sum + (latest.get(line.key) ?? 0), 0);
  const toggle = (key: string) =>
    setHidden(previous => {
      const next = new Set(previous);
      if (!next.delete(key)) {
        next.add(key);
      }
      return next;
    });

  return (
    <>
      <Figure className={`seneca-chart__total ${PRIVATE_CLASS}`}>
        {formatNetAmount(total, formatAmount)}
      </Figure>
      {/* biome-ignore lint/a11y/useSemanticElements: a fieldset brings borders and is meant for form fields */}
      <div className="seneca-chart__legend" role="group" aria-label={t.viewChart.value}>
        {lines.map((line, index) => (
          <button
            key={line.key}
            type="button"
            className="seneca-chart__legend-item"
            style={{ '--legend-tone': tones[index] } as React.CSSProperties}
            aria-pressed={!hidden.has(line.key)}
            onClick={() => toggle(line.key)}
          >
            {line.name}{' '}
            <PrivateAmount>
              {formatNetAmount(latest.get(line.key) ?? 0, formatAmount)}
            </PrivateAmount>
          </button>
        ))}
      </div>
      <div className="seneca-chart__box">
        <LazyAccountBalanceLines
          rows={rows}
          lines={lines
            .map((line, index) => ({ key: line.key, name: line.name, tone: tones[index] }))
            .filter(line => !hidden.has(line.key))}
          today={data.days.some(day => day.date === today) ? today : null}
          locale={locale}
          labels={{ today: t.today.value, total: t.total.value }}
          formatAmount={formatAmount}
        />
      </div>
      {data.unconverted.length > 0 && (
        <p className="seneca-dashboard__card-note" style={{ color: 'var(--attention)' }}>
          {t.missingRates.value.replace('{{currencies}}', data.unconverted.join(', '))}
        </p>
      )}
    </>
  );
}
