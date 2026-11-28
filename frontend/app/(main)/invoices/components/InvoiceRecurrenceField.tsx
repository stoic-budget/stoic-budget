'use client';

import { Button } from '@mui/material';
import type React from 'react';
import { FORM_CONTROL_SX } from '@/app/components/ui/input';
import { Select } from '@/app/components/ui/select';
import { useIntlayer } from '@/app/i18n';
import type { Invoice } from '@/app/lib/invoices-api';
import { useStopRecurring } from '../hooks/useStopRecurring';

/**
 * How often the invoice repeats. Read-only here (a draft sets it in the
 * wizard); an invoice that repeats can always be stopped, issued or not,
 * since its copies keep billing the client. A void invoice repeats no more.
 */
export function InvoiceRecurrenceField({
  invoice,
  recurrenceInterval,
  onStopped,
}: {
  invoice: Invoice | null;
  recurrenceInterval: string | null | undefined;
  onStopped: (invoice: Invoice) => void;
}): React.ReactElement {
  const t = useIntlayer('invoicesPage');
  const { stop, stopping } = useStopRecurring(onStopped);
  const repeats = Boolean(invoice?.isRecurring) && invoice?.status !== 'void';

  return (
    <div className="seneca-payable-drawer__field-group">
      <label className="seneca-payable-drawer__field-label" htmlFor="invoice-recurrence">
        {t.detail.recurring.value}
      </label>
      <Select
        fullWidth
        id="invoice-recurrence"
        sx={FORM_CONTROL_SX}
        value={(invoice?.status === 'void' ? null : recurrenceInterval) || 'none'}
        disabled
        onChange={() => undefined}
        options={[
          { value: 'none', label: t.actions.cancel.value },
          { value: 'weekly', label: t.detail.recurrenceInterval.weekly.value },
          { value: 'monthly', label: t.detail.recurrenceInterval.monthly.value },
          { value: 'quarterly', label: t.detail.recurrenceInterval.quarterly.value },
          { value: 'yearly', label: t.detail.recurrenceInterval.yearly.value },
        ]}
      />
      {repeats && invoice ? (
        <Button
          variant="text"
          size="small"
          disabled={stopping}
          onClick={() => void stop(invoice)}
          sx={{ alignSelf: 'flex-start', color: 'var(--primary)', textTransform: 'none' }}
        >
          {t.detail.stopRecurring.value}
        </Button>
      ) : null}
    </div>
  );
}
