'use client';

import Button from '@mui/material/Button';
import { useMemo, useState } from 'react';
import { LazyLoanBalanceLines } from '@/app/components/charts/lazy-charts';
import { EmptyState } from '@/app/components/ui/EmptyState';
import { CalendarLineIcon } from '@/app/components/ui/empty-state-icons';
import { ReadOnlyHint } from '@/app/components/versions/ReadOnlyHint';
import { useIntlayer } from '@/app/i18n';
import { formatMoney } from '@/app/lib/format-money';
import type { Account } from '../../hooks/useAccounts';
import { useLoan, useLoanMutations } from '../../hooks/useLoan';
import { cardStyle, titleStyle } from '../account-detail-styles';
import { LoanPaymentsCard } from './LoanPaymentsCard';
import { LoanScheduleTable } from './LoanScheduleTable';
import { LoanTermsCard } from './LoanTermsCard';
import { LoanTermsDrawer } from './LoanTermsDrawer';
import { LoanWhatIfPanel } from './LoanWhatIfPanel';
import { loanChartPoints } from './loan-chart-points';
import { emptyLoanForm, type LoanForm, termsToForm } from './loan-form';

/** The loan part of a debt account's page: terms, balance against the plan, what-if, schedule. */
export function LoanSection({
  account,
  money,
  locale,
}: {
  account: Account;
  money: (value: number) => string;
  locale: string;
}): React.JSX.Element | null {
  const t = useIntlayer('loanSchedule');
  const { terms, schedule, isPending } = useLoan(account.id, true);
  const mutations = useLoanMutations(account.id, t.failed.value);
  const [drawer, setDrawer] = useState<LoanForm | null>(null);
  const points = useMemo(() => (schedule ? loanChartPoints(schedule) : []), [schedule]);

  // The form starts from the terms as they are when it opens, never a copy kept from before.
  const open = () =>
    setDrawer(
      terms
        ? termsToForm(terms)
        : emptyLoanForm(Math.max(0, -account.balance), new Date().toISOString().slice(0, 10)),
    );
  const close = () => setDrawer(null);

  if (isPending) {
    return null;
  }

  return (
    <>
      {terms ? (
        <LoanTermsCard
          terms={terms}
          schedule={schedule}
          money={money}
          locale={locale}
          onEdit={open}
        />
      ) : (
        <section style={cardStyle}>
          <EmptyState
            compact
            size="sm"
            icon={<CalendarLineIcon />}
            title={t.emptyTitle}
            description={t.emptyBody}
            action={
              <ReadOnlyHint>
                <Button variant="outlined" onClick={open}>
                  {t.setUp}
                </Button>
              </ReadOnlyHint>
            }
          />
        </section>
      )}

      {schedule && points.length > 1 && (
        <section style={cardStyle}>
          <h2 style={titleStyle}>{t.chartTitle}</h2>
          <div className="seneca-chart__box">
            <LazyLoanBalanceLines
              points={points}
              labels={{
                planned: t.planned.value,
                actual: t.actual.value,
                projected: t.projected.value,
              }}
              locale={locale}
              formatValue={money}
              formatTick={value =>
                formatMoney(value, account.currency, locale, { notation: 'compact' })
              }
            />
          </div>
        </section>
      )}

      {terms && <LoanPaymentsCard walletId={account.id} money={money} locale={locale} />}

      {schedule && (
        <LoanWhatIfPanel walletId={account.id} schedule={schedule} money={money} locale={locale} />
      )}
      {schedule && <LoanScheduleTable schedule={schedule} money={money} locale={locale} />}

      <LoanTermsDrawer
        open={drawer !== null}
        initial={drawer ?? emptyLoanForm(0, new Date().toISOString().slice(0, 10))}
        editing={terms !== null}
        saving={mutations.saving}
        onClose={close}
        onSave={body => void mutations.save(body).then(ok => ok && close())}
        onRemove={() => void mutations.remove().then(ok => ok && close())}
      />
    </>
  );
}
