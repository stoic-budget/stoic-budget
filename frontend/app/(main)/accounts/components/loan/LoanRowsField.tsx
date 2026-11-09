'use client';

import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import { Plus, X } from '@/app/components/icons';
import { Field } from '../AccountSideDrawer';

export interface LoanRow {
  date: string;
  value: string;
}

/** A list of (date, number) rows: rate changes, or one-off extra payments. */
export function LoanRowsField({
  id,
  label,
  hint,
  rows,
  dateLabel,
  valueLabel,
  addLabel,
  removeLabel,
  onChange,
}: {
  id: string;
  label: React.ReactNode;
  hint?: React.ReactNode;
  rows: LoanRow[];
  dateLabel: string;
  valueLabel: string;
  addLabel: React.ReactNode;
  removeLabel: string;
  onChange: (rows: LoanRow[]) => void;
}): React.JSX.Element {
  const set = (index: number, patch: Partial<LoanRow>) =>
    onChange(rows.map((row, at) => (at === index ? { ...row, ...patch } : row)));
  return (
    <Field label={label} hint={hint}>
      <div style={{ display: 'grid', gap: 8 }}>
        {rows.map((row, index) => (
          <div
            // Rows have no id of their own until they are saved.
            // biome-ignore lint/suspicious/noArrayIndexKey: an editable list in order
            key={index}
            style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8 }}
          >
            <TextField
              id={`${id}-date-${index}`}
              type="date"
              size="small"
              value={row.date}
              onChange={event => set(index, { date: event.target.value })}
              slotProps={{ htmlInput: { 'aria-label': dateLabel } }}
            />
            <TextField
              id={`${id}-value-${index}`}
              size="small"
              value={row.value}
              placeholder={valueLabel}
              onChange={event => set(index, { value: event.target.value })}
              slotProps={{ htmlInput: { inputMode: 'decimal', 'aria-label': valueLabel } }}
            />
            <Button
              variant="text"
              aria-label={removeLabel}
              onClick={() => onChange(rows.filter((_, at) => at !== index))}
              sx={{ minWidth: 0, px: 1 }}
            >
              <X size={18} aria-hidden />
            </Button>
          </div>
        ))}
        <Button
          variant="text"
          sx={{ justifySelf: 'start' }}
          startIcon={<Plus size={18} aria-hidden />}
          onClick={() => onChange([...rows, { date: '', value: '' }])}
        >
          {addLabel}
        </Button>
      </div>
    </Field>
  );
}
