'use client';
import TextField from '@mui/material/TextField';
import { useState } from 'react';
import { ModalFooter, ModalShell } from '@/app/components/ui/modal-shell';
import { TextTabs } from '@/app/components/ui/text-tabs';
import type { Transaction } from '../editHelpers';
import type { RowValues } from '../hooks/useRowFixes';

export type RowEditLabels = {
  editRow: string;
  addRow: string;
  date: string;
  counterparty: string;
  paymentPurpose: string;
  amount: string;
  moneyOut: string;
  moneyIn: string;
  save: string;
  cancel: string;
};

type Side = 'out' | 'in';

function Labelled({
  id,
  label,
  children,
}: {
  id: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: 'grid', gap: 6 }}>
      <label htmlFor={id} style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-muted)' }}>
        {label}
      </label>
      {children}
    </div>
  );
}

/**
 * One row of a statement typed by hand: a row the reading got wrong, or one
 * it missed (`row` null). The amount is entered as a figure with its side.
 */
export function RowEditDialog({
  row,
  labels,
  onClose,
  onSave,
}: {
  row: Transaction | null;
  labels: RowEditLabels;
  onClose: () => void;
  onSave: (values: RowValues) => Promise<boolean>;
}): React.JSX.Element {
  const [date, setDate] = useState(row?.transactionDate.slice(0, 10) ?? '');
  const [counterparty, setCounterparty] = useState(row?.counterpartyName ?? '');
  const [purpose, setPurpose] = useState(row?.paymentPurpose ?? '');
  const [side, setSide] = useState<Side>(Number(row?.credit) > 0 ? 'in' : 'out');
  const [figure, setFigure] = useState(
    row ? String(Number(row.credit) > 0 ? Number(row.credit) : Number(row.debit) || '') : '',
  );
  const [saving, setSaving] = useState(false);
  const value = Number(figure.replace(',', '.'));
  const ready = /^\d{4}-\d{2}-\d{2}$/.test(date) && counterparty.trim() !== '' && value > 0;

  const save = async () => {
    setSaving(true);
    const saved = await onSave({
      transactionDate: date,
      counterpartyName: counterparty.trim(),
      paymentPurpose: purpose.trim(),
      amount: Math.round((side === 'out' ? -value : value) * 100) / 100,
    });
    setSaving(false);
    if (saved) {
      onClose();
    }
  };

  return (
    <ModalShell
      isOpen
      onClose={onClose}
      title={row ? labels.editRow : labels.addRow}
      size="sm"
      footer={
        <ModalFooter
          onCancel={onClose}
          cancelText={labels.cancel}
          onConfirm={() => void save()}
          confirmText={labels.save}
          isConfirmLoading={saving}
          isConfirmDisabled={!ready}
        />
      }
    >
      <div style={{ display: 'grid', gap: 16 }}>
        <Labelled id="row-date" label={labels.date}>
          <TextField
            id="row-date"
            type="date"
            size="small"
            value={date}
            onChange={event => setDate(event.target.value)}
          />
        </Labelled>
        <Labelled id="row-counterparty" label={labels.counterparty}>
          <TextField
            id="row-counterparty"
            size="small"
            value={counterparty}
            onChange={event => setCounterparty(event.target.value)}
          />
        </Labelled>
        <Labelled id="row-purpose" label={labels.paymentPurpose}>
          <TextField
            id="row-purpose"
            size="small"
            value={purpose}
            onChange={event => setPurpose(event.target.value)}
          />
        </Labelled>
        <Labelled id="row-amount" label={labels.amount}>
          <TextTabs
            value={side}
            onChange={setSide}
            ariaLabel={labels.amount}
            options={[
              { value: 'out', label: labels.moneyOut },
              { value: 'in', label: labels.moneyIn },
            ]}
          />
          <TextField
            id="row-amount"
            size="small"
            inputMode="decimal"
            value={figure}
            onChange={event => setFigure(event.target.value)}
            slotProps={{ htmlInput: { style: { fontVariantNumeric: 'tabular-nums' } } }}
          />
        </Labelled>
      </div>
    </ModalShell>
  );
}
