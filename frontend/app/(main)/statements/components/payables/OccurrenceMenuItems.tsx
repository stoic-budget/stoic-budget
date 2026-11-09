'use client';

import type React from 'react';
import { DropdownMenuItem } from '@/app/components/ui/dropdown-menu';
import { useIntlayer } from '@/app/i18n';
import type { Payable } from '@/app/lib/payables-api';
import type { OccurrenceAction } from './hooks/usePayableOccurrence';

/** Skip, move or re-price one occurrence of a repeating bill that nothing is paid on yet. */
export function OccurrenceMenuItems({
  payable,
  onAction,
}: {
  payable: Payable;
  onAction?: (payable: Payable, action: OccurrenceAction) => void;
}): React.JSX.Element | null {
  const t = useIntlayer('payableRecurrence');
  const open =
    payable.status !== 'paid' && payable.status !== 'archived' && Number(payable.paidAmount) === 0;
  if (!(onAction && payable.seriesId && open)) return null;
  return (
    <>
      <DropdownMenuItem onClick={() => onAction(payable, 'skip')}>
        {t.skipThis.value}
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => onAction(payable, 'move')}>
        {t.moveThis.value}
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => onAction(payable, 'amount')}>
        {t.amountThis.value}
      </DropdownMenuItem>
    </>
  );
}
