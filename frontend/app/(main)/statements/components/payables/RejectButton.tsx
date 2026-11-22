'use client';

import type React from 'react';
import { useIntlayer } from '@/app/i18n';

/** "Not this payment" under a proposed bank row: a quiet text button, never a second choice. */
export function RejectButton({
  id,
  onReject,
  indented = false,
}: {
  id: string;
  onReject: (id: string) => void;
  /** Lined up with the label of the radio above it. */
  indented?: boolean;
}): React.JSX.Element {
  const t = useIntlayer('payableRecurrence');
  const modifier = indented ? ' seneca-payable-candidate__reject--indented' : '';
  return (
    <button
      type="button"
      className={`seneca-payable-candidate__reject${modifier}`}
      onClick={() => onReject(id)}
    >
      {t.notThisPayment.value}
    </button>
  );
}
