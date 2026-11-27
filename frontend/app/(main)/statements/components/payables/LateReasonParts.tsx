'use client';

import type React from 'react';
import { DropdownMenuItem } from '@/app/components/ui/dropdown-menu';
import { useIntlayer } from '@/app/i18n';
import type { Payable } from '@/app/lib/payables-api';
import { wasLate } from './late-reason-utils';

/** The row's menu item that asks why a late bill was late. */
export function LateReasonMenuItem({
  payable,
  onSelect,
}: {
  payable: Payable;
  onSelect?: (payable: Payable) => void;
}): React.JSX.Element | null {
  const t = useIntlayer('lateReasons');
  // A reason given can always be changed or taken back, late or not any more.
  if (!(onSelect && (wasLate(payable) || payable.lateReason))) return null;
  return <DropdownMenuItem onClick={() => onSelect(payable)}>{t.question.value}</DropdownMenuItem>;
}

const linkStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  padding: 0,
  font: 'inherit',
  color: 'var(--primary)',
  cursor: 'pointer',
};

/**
 * After the status: the reason given for being late, or, on a late bill with
 * none yet, the question itself, where the overdue notice lands. Either opens
 * the question; the row's own click (open the bill) does not fire.
 */
export function LateReasonNote({
  payable,
  onAsk,
}: {
  payable: Payable;
  onAsk?: (payable: Payable) => void;
}): React.JSX.Element | null {
  const t = useIntlayer('lateReasons');
  if (!(payable.lateReason || (onAsk && wasLate(payable)))) return null;
  const text = payable.lateReason ? t[payable.lateReason].value : t.question.value;
  return (
    <span className="seneca-payable-status__since">
      {' · '}
      {onAsk ? (
        <button
          type="button"
          style={linkStyle}
          onClick={event => {
            event.stopPropagation();
            onAsk(payable);
          }}
        >
          {text}
        </button>
      ) : (
        text
      )}
    </span>
  );
}
