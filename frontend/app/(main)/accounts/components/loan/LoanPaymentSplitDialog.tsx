'use client';

import TextField from '@mui/material/TextField';
import { useEffect, useState } from 'react';
import { ModalFooter, ModalShell } from '@/app/components/ui/modal-shell';
import { useIntlayer } from '@/app/i18n';
import type { LoanPaymentItem } from '@/app/lib/contracts';
import { Field } from '../AccountSideDrawer';
import { figureStyle, mutedStyle } from '../account-detail-styles';
import { interestFrom } from './loan-payment-split';

/**
 * The split of one payment: the interest, suggested by the schedule and
 * editable; the principal is what is left. `item` is the row as the list has
 * it now, so a refreshed list shows through.
 */
export function LoanPaymentSplitDialog({
  item,
  saving,
  money,
  onClose,
  onSave,
}: {
  item: LoanPaymentItem | null;
  saving: boolean;
  money: (value: number) => string;
  onClose: () => void;
  onSave: (interest: number) => void;
}): React.JSX.Element {
  const t = useIntlayer('loanPayments');
  const [typed, setTyped] = useState('');
  const transactionId = item?.transactionId;
  const suggested = item?.suggestion?.interest ?? 0;

  // A new payment opens with the schedule's interest; the same one keeps what was typed.
  useEffect(() => {
    if (transactionId) {
      setTyped(suggested > 0 ? String(suggested) : '');
    }
  }, [transactionId, suggested]);

  const interest = item ? interestFrom(typed, item.amount) : null;
  const scheduled = item?.suggestion;

  return (
    <ModalShell
      isOpen={item !== null}
      onClose={onClose}
      title={t.dialogTitle}
      size="sm"
      footer={
        <ModalFooter
          onCancel={onClose}
          cancelText={t.cancel.value}
          onConfirm={() => interest !== null && onSave(interest)}
          confirmText={t.split.value}
          isConfirmDisabled={interest === null}
          isConfirmLoading={saving}
        />
      }
    >
      {item && (
        <div style={{ display: 'grid', gap: 14 }}>
          <div style={{ display: 'grid', gap: 2 }}>
            <span style={mutedStyle}>{t.payment}</span>
            <span style={figureStyle}>{money(item.amount)}</span>
            {scheduled?.period != null && scheduled.scheduledPayment != null && (
              <span style={mutedStyle}>
                {t.scheduled.value
                  .replace('{{period}}', String(scheduled.period))
                  .replace('{{amount}}', money(scheduled.scheduledPayment))}
              </span>
            )}
          </div>
          <Field id="loan-split-interest" label={t.interest}>
            <TextField
              id="loan-split-interest"
              size="small"
              fullWidth
              value={typed}
              onChange={event => setTyped(event.target.value)}
              slotProps={{ htmlInput: { inputMode: 'decimal' } }}
            />
          </Field>
          {typed.trim() !== '' && interest === null && (
            <span role="alert" style={{ ...mutedStyle, color: 'var(--money-down)' }}>
              {t.interestInvalid}
            </span>
          )}
          <div style={{ display: 'grid', gap: 2 }}>
            <span style={mutedStyle}>{t.principal}</span>
            <span style={figureStyle}>
              {interest === null
                ? '—'
                : money((Math.round(item.amount * 100) - Math.round(interest * 100)) / 100)}
            </span>
          </div>
        </div>
      )}
    </ModalShell>
  );
}
