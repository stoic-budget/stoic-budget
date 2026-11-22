'use client';

import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import { useState } from 'react';
import { TextTabs } from '@/app/components/ui/text-tabs';
import { useIntlayer } from '@/app/i18n';
import type { LoanExtraMode, LoanSchedule } from '@/app/lib/contracts';
import { useLoanWhatIf } from '../../hooks/useLoan';
import { Field } from '../AccountSideDrawer';
import {
  cardStyle,
  figureStyle,
  formatDay,
  mutedStyle,
  titleStyle,
} from '../account-detail-styles';
import { parseNumber } from './loan-form';

const positive = (value: string) => {
  const number = parseNumber(value);
  return number !== null && number >= 0.01 ? Math.round(number * 100) / 100 : null;
};

/** Extra payments tried on top of the plan: months and interest they would save. Nothing is saved. */
export function LoanWhatIfPanel({
  walletId,
  schedule,
  money,
  locale,
}: {
  walletId: string;
  schedule: LoanSchedule;
  money: (value: number) => string;
  locale: string;
}): React.JSX.Element {
  const t = useIntlayer('loanSchedule');
  const whatIf = useLoanWhatIf(walletId, t.failed.value);
  const nextDate =
    schedule.plan.rows.find(row => row.date > schedule.today)?.date ?? schedule.today;
  const [oneOff, setOneOff] = useState('');
  const [oneOffDate, setOneOffDate] = useState(nextDate);
  const [monthly, setMonthly] = useState('');
  const [mode, setMode] = useState<LoanExtraMode>('reduce_term');

  // A result always matches the inputs on screen: any change clears it.
  const change =
    <T,>(setter: (value: T) => void) =>
    (value: T) => {
      setter(value);
      whatIf.reset();
    };
  const oneOffAmount = positive(oneOff);
  const monthlyAmount = positive(monthly);
  const canRun =
    (oneOffAmount !== null && /^\d{4}-\d{2}-\d{2}$/.test(oneOffDate)) || monthlyAmount !== null;
  const result = whatIf.result;

  return (
    <section style={cardStyle}>
      <h2 style={titleStyle}>{t.whatIfTitle}</h2>
      <span style={mutedStyle}>{t.whatIfHint}</span>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          gap: 12,
        }}
      >
        <Field id="what-if-one-off" label={t.oneOff}>
          <TextField
            id="what-if-one-off"
            size="small"
            value={oneOff}
            onChange={event => change(setOneOff)(event.target.value)}
            slotProps={{ htmlInput: { inputMode: 'decimal' } }}
          />
        </Field>
        <Field id="what-if-date" label={t.date}>
          <TextField
            id="what-if-date"
            type="date"
            size="small"
            value={oneOffDate}
            onChange={event => change(setOneOffDate)(event.target.value)}
          />
        </Field>
        <Field id="what-if-monthly" label={t.monthly}>
          <TextField
            id="what-if-monthly"
            size="small"
            value={monthly}
            onChange={event => change(setMonthly)(event.target.value)}
            slotProps={{ htmlInput: { inputMode: 'decimal' } }}
          />
        </Field>
      </div>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <TextTabs<LoanExtraMode>
          value={mode}
          onChange={change(setMode)}
          ariaLabel={t.extraMode.value}
          options={[
            { value: 'reduce_term', label: t.reduceTerm },
            { value: 'reduce_payment', label: t.reducePayment },
          ]}
        />
        <Button
          variant="outlined"
          disabled={!canRun || whatIf.pending}
          onClick={() =>
            whatIf.run({
              extraPayments:
                oneOffAmount !== null ? [{ date: oneOffDate, amount: oneOffAmount }] : [],
              recurringExtra:
                monthlyAmount !== null ? { amount: monthlyAmount, from: nextDate } : null,
              mode,
            })
          }
        >
          {t.calculate}
        </Button>
      </div>
      {result && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
            gap: 16,
          }}
        >
          <div style={{ display: 'grid', gap: 2 }}>
            <span style={mutedStyle}>{t.monthsSaved}</span>
            <span style={figureStyle}>{result.monthsSaved}</span>
          </div>
          <div style={{ display: 'grid', gap: 2 }}>
            <span style={mutedStyle}>{t.interestSaved}</span>
            <span style={figureStyle}>{money(result.interestSaved)}</span>
          </div>
          {result.scenario.payoffDate && (
            <div style={{ display: 'grid', gap: 2 }}>
              <span style={mutedStyle}>{t.payoffDate}</span>
              <span style={figureStyle}>{formatDay(result.scenario.payoffDate, locale)}</span>
            </div>
          )}
          {mode === 'reduce_payment' && result.paymentAfter !== null && (
            <div style={{ display: 'grid', gap: 2 }}>
              <span style={mutedStyle}>{t.paymentAfter}</span>
              <span style={figureStyle}>{money(result.paymentAfter)}</span>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
