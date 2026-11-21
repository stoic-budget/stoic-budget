'use client';

import type React from 'react';
import CustomDatePicker from '@/app/components/CustomDatePicker';
import { FORM_CONTROL_SX } from '@/app/components/ui/input';
import { Select } from '@/app/components/ui/select';
import type { Payable, PayableSource } from '@/app/lib/payables-api';
import type { PayableFormState } from './payable-form-state';
import { RepeatFields } from './RepeatFields';

interface PayableScheduleFieldsProps {
  form: PayableFormState;
  setForm: React.Dispatch<React.SetStateAction<PayableFormState>>;
  /** The bill being edited: a series stays anchored on its occurrence's own day. */
  payable?: Payable | null;
  labels: { dueDate: string; source: string; sourceOptions: Record<PayableSource, string> };
}

/** When the bill is due, where it came from, and how it repeats. */
export function PayableScheduleFields({
  form,
  setForm,
  payable,
  labels,
}: PayableScheduleFieldsProps): React.JSX.Element {
  return (
    <>
      <div className="seneca-payable-drawer__2col">
        <div className="seneca-payable-drawer__field-group">
          <label className="seneca-payable-drawer__field-label" htmlFor="payable-due-date">
            {labels.dueDate}
          </label>
          <CustomDatePicker
            id="payable-due-date"
            large
            value={form.dueDate || null}
            onChange={value => setForm(prev => ({ ...prev, dueDate: value }))}
          />
        </div>
        <div className="seneca-payable-drawer__field-group">
          <label className="seneca-payable-drawer__field-label" htmlFor="payable-source">
            {labels.source}
          </label>
          <Select
            fullWidth
            id="payable-source"
            sx={FORM_CONTROL_SX}
            value={form.source}
            onChange={value => setForm(prev => ({ ...prev, source: value as PayableSource }))}
            options={Object.entries(labels.sourceOptions).map(([value, label]) => ({
              value,
              label,
            }))}
          />
        </div>
      </div>
      <RepeatFields
        value={form.repeat}
        onChange={repeat => setForm(prev => ({ ...prev, repeat }))}
        anchor={payable?.occurrenceDate ?? form.dueDate}
        remindDaysBefore={form.remindDaysBefore}
        onRemindChange={remindDaysBefore => setForm(prev => ({ ...prev, remindDaysBefore }))}
      />
    </>
  );
}
