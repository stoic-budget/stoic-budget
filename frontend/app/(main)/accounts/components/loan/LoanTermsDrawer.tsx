'use client';

import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import { useEffect, useState } from 'react';
import { Select } from '@/app/components/ui/select';
import { TextTabs } from '@/app/components/ui/text-tabs';
import { useIntlayer } from '@/app/i18n';
import type { LoanDayCount, LoanExtraMode, LoanMethod, LoanTermsBody } from '@/app/lib/contracts';
import { AccountSideDrawer, Field } from '../AccountSideDrawer';
import { LoanRowsField } from './LoanRowsField';
import { formToBody, type LoanForm } from './loan-form';

interface LoanTermsDrawerProps {
  open: boolean;
  /** Read when the drawer opens: the terms as they are now, not as they were. */
  initial: LoanForm;
  editing: boolean;
  saving: boolean;
  onClose: () => void;
  onSave: (body: LoanTermsBody) => void;
  onRemove: () => void;
}

export function LoanTermsDrawer({
  open,
  initial,
  editing,
  saving,
  onClose,
  onSave,
  onRemove,
}: LoanTermsDrawerProps): React.JSX.Element {
  const t = useIntlayer('loanSchedule');
  const [form, setForm] = useState<LoanForm>(initial);
  const [tried, setTried] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(initial);
      setTried(false);
    }
  }, [open, initial]);

  const set = (patch: Partial<LoanForm>) => setForm(prev => ({ ...prev, ...patch }));
  const body = formToBody(form);
  const submit = () => {
    setTried(true);
    if (body) {
      onSave(body);
    }
  };
  const text = (id: string, label: React.ReactNode, key: keyof LoanForm, decimal = true) => (
    <Field id={id} label={label}>
      <TextField
        id={id}
        size="small"
        fullWidth
        value={form[key] as string}
        onChange={event => set({ [key]: event.target.value })}
        slotProps={{ htmlInput: { inputMode: decimal ? 'decimal' : 'numeric' } }}
      />
    </Field>
  );

  return (
    <AccountSideDrawer
      open={open}
      title={t.sectionTitle.value}
      backLabel={t.cancel.value}
      onClose={onClose}
      footer={
        <>
          {editing && (
            <Button variant="text" onClick={onRemove} disabled={saving} sx={{ mr: 'auto' }}>
              {t.removeTerms}
            </Button>
          )}
          <Button variant="text" onClick={onClose} disabled={saving}>
            {t.cancel}
          </Button>
          <Button variant="contained" onClick={submit} disabled={saving}>
            {t.save}
          </Button>
        </>
      }
    >
      {text('loan-principal', t.principal, 'principal')}
      <Field id="loan-start" label={t.startDate}>
        <TextField
          id="loan-start"
          type="date"
          size="small"
          fullWidth
          value={form.startDate}
          onChange={event => set({ startDate: event.target.value })}
        />
      </Field>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {text('loan-term', t.termMonths, 'termMonths', false)}
        {text('loan-rate', t.annualRate, 'annualRate')}
      </div>
      <Field id="loan-day" label={t.paymentDay} hint={t.paymentDayHint}>
        <TextField
          id="loan-day"
          size="small"
          fullWidth
          value={form.paymentDay}
          onChange={event => set({ paymentDay: event.target.value })}
          slotProps={{ htmlInput: { inputMode: 'numeric' } }}
        />
      </Field>
      <Field id="loan-method" label={t.method}>
        <Select
          id="loan-method"
          size="small"
          fullWidth
          value={form.method}
          options={[
            { value: 'annuity', label: t.methodAnnuity.value },
            { value: 'linear', label: t.methodLinear.value },
            { value: 'interest_only', label: t.methodInterestOnly.value },
          ]}
          onChange={value => set({ method: value as LoanMethod })}
        />
      </Field>
      <Field id="loan-day-count" label={t.dayCount}>
        <Select
          id="loan-day-count"
          size="small"
          fullWidth
          value={form.dayCount}
          options={[
            { value: '30/360', label: t.dayCount360.value },
            { value: 'actual/365', label: t.dayCount365.value },
          ]}
          onChange={value => set({ dayCount: value as LoanDayCount })}
        />
      </Field>
      <LoanRowsField
        id="loan-rate-changes"
        label={t.rateChanges}
        hint={t.rateChangesHint}
        rows={form.rateChanges.map(change => ({ date: change.from, value: change.annualRate }))}
        dateLabel={t.fromDate.value}
        valueLabel={t.annualRate.value}
        addLabel={t.addRateChange}
        removeLabel={t.remove.value}
        onChange={rows =>
          set({ rateChanges: rows.map(row => ({ from: row.date, annualRate: row.value })) })
        }
      />
      <LoanRowsField
        id="loan-extras"
        label={t.extraPayments}
        rows={form.extraPayments.map(extra => ({ date: extra.date, value: extra.amount }))}
        dateLabel={t.date.value}
        valueLabel={t.amount.value}
        addLabel={t.addExtraPayment}
        removeLabel={t.remove.value}
        onChange={rows =>
          set({ extraPayments: rows.map(row => ({ date: row.date, amount: row.value })) })
        }
      />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {text('loan-monthly', t.monthlyExtra, 'monthlyExtra')}
        <Field id="loan-monthly-from" label={t.fromDate}>
          <TextField
            id="loan-monthly-from"
            type="date"
            size="small"
            fullWidth
            value={form.monthlyExtraFrom}
            onChange={event => set({ monthlyExtraFrom: event.target.value })}
          />
        </Field>
      </div>
      <Field label={t.extraMode}>
        <TextTabs<LoanExtraMode>
          value={form.extraMode}
          onChange={extraMode => set({ extraMode })}
          ariaLabel={t.extraMode.value}
          options={[
            { value: 'reduce_term', label: t.reduceTerm },
            { value: 'reduce_payment', label: t.reducePayment },
          ]}
        />
      </Field>
      {tried && !body && (
        <span role="alert" style={{ fontSize: 13, color: 'var(--money-down)' }}>
          {t.invalid}
        </span>
      )}
    </AccountSideDrawer>
  );
}
