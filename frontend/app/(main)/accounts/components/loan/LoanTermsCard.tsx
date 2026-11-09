'use client';

import Button from '@mui/material/Button';
import { ReadOnlyHint } from '@/app/components/versions/ReadOnlyHint';
import { useIntlayer } from '@/app/i18n';
import type { LoanSchedule, LoanTermsItem } from '@/app/lib/contracts';
import {
  cardStyle,
  figureStyle,
  formatDay,
  mutedStyle,
  titleStyle,
} from '../account-detail-styles';

const statGrid = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
  gap: 16,
} as const;

function Stat({ label, value }: { label: React.ReactNode; value: string }): React.JSX.Element {
  return (
    <div style={{ display: 'grid', gap: 2 }}>
      <span style={mutedStyle}>{label}</span>
      <span style={figureStyle}>{value}</span>
    </div>
  );
}

/** The terms in figures, and where the account stands today against them. */
export function LoanTermsCard({
  terms,
  schedule,
  money,
  locale,
  onEdit,
}: {
  terms: LoanTermsItem;
  schedule: LoanSchedule | null;
  money: (value: number) => string;
  locale: string;
  onEdit: () => void;
}): React.JSX.Element {
  const t = useIntlayer('loanSchedule');
  const methods = {
    annuity: t.methodAnnuity.value,
    linear: t.methodLinear.value,
    interest_only: t.methodInterestOnly.value,
  };
  const plan = schedule?.plan;
  const nextRow = plan?.rows.find(row => row.date > (schedule?.today ?? ''));
  const rate = nextRow?.annualRate ?? Number(terms.annualRate);
  const actual = schedule?.actual;
  const percent = new Intl.NumberFormat(locale, { maximumFractionDigits: 4 });

  let standing: string | null = null;
  if (actual) {
    const gap = Math.abs(actual.difference);
    standing =
      gap < 0.005
        ? t.onPlan.value
        : (actual.difference < 0 ? t.ahead.value : t.behind.value).replace(
            '{{amount}}',
            money(gap),
          );
  }

  return (
    <section style={cardStyle}>
      <div
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}
      >
        <h2 style={titleStyle}>{t.sectionTitle}</h2>
        <ReadOnlyHint>
          <Button variant="text" onClick={onEdit}>
            {t.edit}
          </Button>
        </ReadOnlyHint>
      </div>
      <span style={mutedStyle}>
        {[
          money(Number(terms.principal)),
          `${percent.format(rate)} %`,
          `${t.termMonths.value}: ${terms.termMonths}`,
          methods[terms.method],
          terms.dayCount,
        ].join(' · ')}
      </span>
      <div style={statGrid}>
        {plan && (
          // The payment due next: after a rate change it is no longer the first one.
          <Stat label={t.regularPayment} value={money(nextRow?.payment ?? plan.regularPayment)} />
        )}
        {plan?.payoffDate && (
          <Stat label={t.payoffDate} value={formatDay(plan.payoffDate, locale)} />
        )}
        {plan && <Stat label={t.totalInterest} value={money(plan.totalInterest)} />}
        {actual && <Stat label={t.owedToday} value={money(actual.balance)} />}
      </div>
      {standing && <span style={mutedStyle}>{standing}</span>}
    </section>
  );
}
