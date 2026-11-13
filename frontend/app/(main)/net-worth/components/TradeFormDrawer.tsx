'use client';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import { useState } from 'react';
import { DrawerShell } from '@/app/components/ui/drawer-shell';
import { Select } from '@/app/components/ui/select';
import { useIntlayer } from '@/app/i18n';
import type { InvestmentTrade, TradeInput } from '../hooks/useInvestmentTrades';
import { LabeledField } from './LabeledField';
import {
  buildTrade,
  emptyForm,
  FORM_KINDS,
  type FormKind,
  fieldsOf,
  formFromTrade,
  type TradeFormError,
  type TradeFormState,
} from './trade-form';
import { KIND_KEYS } from './trade-labels';

interface TradeFormDrawerProps {
  open: boolean;
  /** The trade being edited; null for a new one. */
  trade: InvestmentTrade | null;
  /** The currency the holding's trades are in, or its price currency before the first. */
  currency: string;
  saving: boolean;
  onClose: () => void;
  onSave: (input: TradeInput) => Promise<unknown>;
}

const today = () => new Date().toISOString().slice(0, 10);

/** A buy, sale, dividend or transfer, entered or corrected; only the fields its kind uses. */
export function TradeFormDrawer({
  open,
  trade,
  currency,
  saving,
  onClose,
  onSave,
}: TradeFormDrawerProps) {
  const t = useIntlayer('investmentTrades');
  // Filled once per opening (the parent keys it by the trade): a refetch never wipes what is typed.
  const [form, setForm] = useState<TradeFormState>(() =>
    trade ? formFromTrade(trade) : emptyForm(currency, today()),
  );
  const [error, setError] = useState<TradeFormError | null>(null);

  const set = (key: keyof TradeFormState) => (value: string) =>
    setForm(prev => ({ ...prev, [key]: value }));
  const shown = fieldsOf(form.kind);
  const priceLabel =
    form.kind === 'transfer_in'
      ? t.costPerUnit.value
      : form.kind === 'transfer_out'
        ? t.valuePerUnit.value
        : t.price.value;

  const submit = async () => {
    const built = buildTrade(form);
    if ('error' in built) {
      setError(built.error);
      return;
    }
    try {
      await onSave(built);
      onClose();
    } catch {
      // The hook has said what went wrong; the form stays as typed.
    }
  };

  const field = (key: keyof TradeFormState, label: string, type = 'text', decimal = false) => (
    <LabeledField
      label={label}
      type={type}
      decimal={decimal}
      value={form[key]}
      onChange={set(key)}
    />
  );

  return (
    <DrawerShell
      isOpen={open}
      onClose={onClose}
      title={trade ? t.editTrade.value : t.addTrade.value}
      width="md"
      footer={
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
          <Button variant="text" color="inherit" onClick={onClose}>
            {t.cancel}
          </Button>
          <Button variant="contained" disabled={saving} onClick={() => void submit()}>
            {t.save}
          </Button>
        </Box>
      }
    >
      <Box
        sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2, pt: 1 }}
      >
        <Box>
          <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: 13, mb: 0.5 }}>
            {t.kind}
          </Typography>
          <Select
            size="small"
            fullWidth
            aria-label={t.kind.value}
            value={form.kind}
            options={FORM_KINDS.map(kind => ({ value: kind, label: t[KIND_KEYS[kind]].value }))}
            onChange={value => set('kind')(value as FormKind)}
            data-testid="trade-kind"
          />
        </Box>
        {field('date', t.date.value, 'date')}
        {shown.units && field('quantity', t.quantity.value, 'text', true)}
        {shown.units && field('price', `${priceLabel} (${form.currency})`, 'text', true)}
        {shown.amount && field('amount', `${t.amount.value} (${form.currency})`, 'text', true)}
        {field('fee', form.kind === 'dividend' ? t.taxWithheld.value : t.fee.value, 'text', true)}
        {shown.acquiredOn && field('acquiredOn', t.acquiredOn.value, 'date')}
        {field('currency', t.currency.value)}
        <Box sx={{ gridColumn: '1 / -1' }}>{field('note', t.note.value)}</Box>
      </Box>
      {error && (
        <Typography variant="body2" role="alert" sx={{ color: 'var(--money-down)', mt: 2 }}>
          {t[error]}
        </Typography>
      )}
    </DrawerShell>
  );
}
