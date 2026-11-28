'use client';

import type React from 'react';
import { useState } from 'react';
import { Button } from '@/app/components/ui/button';
import { ChoiceCards } from '@/app/components/ui/choice-cards';
import { Input } from '@/app/components/ui/input';
import { ModalShell } from '@/app/components/ui/modal-shell';
import { useIntlayer } from '@/app/i18n';
import type { LateReason } from '@/app/lib/late-reasons-api';
import type { Payable } from '@/app/lib/payables-api';
import { useLateReasonLabels } from './hooks/useLateReasons';

interface LateReasonDialogProps {
  /** The late bill being asked about; the dialog is closed while null. */
  payable: Payable | null;
  saving: boolean;
  onClose: () => void;
  onSave: (reason: LateReason | null, note: string) => void;
}

/** "Why was it late?": one of six reasons and a short note, or the reason taken back. */
export function LateReasonDialog(props: LateReasonDialogProps): React.JSX.Element | null {
  if (!props.payable) return null;
  // Keyed so that every bill opens on its own answer.
  return <LateReasonForm {...props} key={props.payable.id} payable={props.payable} />;
}

function LateReasonForm({
  payable,
  saving,
  onClose,
  onSave,
}: LateReasonDialogProps & { payable: Payable }): React.JSX.Element {
  const t = useIntlayer('lateReasons');
  const options = useLateReasonLabels();
  const [reason, setReason] = useState<LateReason | null>(payable.lateReason);
  const [note, setNote] = useState(payable.lateReasonNote ?? '');

  return (
    <ModalShell
      isOpen
      onClose={onClose}
      size="sm"
      title={t.question.value}
      footer={
        <>
          {payable.lateReason && (
            <Button variant="ghost" onClick={() => onSave(null, '')} disabled={saving}>
              {t.clear.value}
            </Button>
          )}
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            {t.cancel.value}
          </Button>
          <Button onClick={() => reason && onSave(reason, note)} disabled={!reason || saving}>
            {t.save.value}
          </Button>
        </>
      }
    >
      <div style={{ display: 'grid', gap: 12 }}>
        <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>{payable.vendor}</span>
        <ChoiceCards<LateReason>
          aria-label={t.question.value}
          options={options.map(option => ({ value: option.value, title: option.label }))}
          value={reason}
          onChange={setReason}
        />
        <label htmlFor="late-reason-note" style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          {t.note.value}
        </label>
        <Input
          id="late-reason-note"
          value={note}
          maxLength={200}
          onChange={event => setNote(event.target.value)}
        />
      </div>
    </ModalShell>
  );
}
