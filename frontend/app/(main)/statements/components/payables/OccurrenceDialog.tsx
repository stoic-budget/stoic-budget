'use client';

import type React from 'react';
import { useEffect, useState } from 'react';
import CustomDatePicker from '@/app/components/CustomDatePicker';
import { Input } from '@/app/components/ui/input';
import { ModalFooter, ModalShell } from '@/app/components/ui/modal-shell';
import { useIntlayer } from '@/app/i18n';
import type { Payable } from '@/app/lib/payables-api';

interface OccurrenceDialogProps {
  editing: { payable: Payable; action: 'move' | 'amount' } | null;
  saving: boolean;
  onClose: () => void;
  onMove: (dueDate: string) => void;
  onAmount: (amount: number) => void;
}

/** A new day or an amount for one occurrence; the rest of the series keeps its own. */
export function OccurrenceDialog({
  editing,
  saving,
  onClose,
  onMove,
  onAmount,
}: OccurrenceDialogProps): React.JSX.Element {
  const t = useIntlayer('payableRecurrence');
  const [value, setValue] = useState('');
  useEffect(() => {
    if (!editing) return;
    setValue(
      editing.action === 'move'
        ? (editing.payable.dueDate ?? '').slice(0, 10)
        : String(editing.payable.amount),
    );
  }, [editing]);
  const isMove = editing?.action === 'move';
  const usable = isMove ? Boolean(value) : Number(value) > 0;
  const confirm = () => {
    if (!usable) return;
    if (isMove) onMove(value);
    else onAmount(Number(value));
  };

  return (
    <ModalShell
      isOpen={Boolean(editing)}
      onClose={onClose}
      size="sm"
      title={isMove ? t.moveThis.value : t.amountThis.value}
      footer={
        <ModalFooter
          onCancel={onClose}
          onConfirm={confirm}
          cancelText={t.cancel.value}
          confirmText={t.save.value}
          isConfirmLoading={saving}
          isConfirmDisabled={!usable}
        />
      }
    >
      <div className="seneca-payable-drawer__field-group">
        <label className="seneca-payable-drawer__field-label" htmlFor="occurrence-value">
          {isMove ? t.newDueDate.value : t.amountForThisOne.value}
        </label>
        {isMove ? (
          <CustomDatePicker id="occurrence-value" large value={value || null} onChange={setValue} />
        ) : (
          <Input
            id="occurrence-value"
            type="number"
            min="0"
            step="0.01"
            value={value}
            onChange={event => setValue(event.target.value)}
          />
        )}
      </div>
      <p className="seneca-payable-drawer__hint">{t.seriesUnchanged.value}</p>
    </ModalShell>
  );
}
