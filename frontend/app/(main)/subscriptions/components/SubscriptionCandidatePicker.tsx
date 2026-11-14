'use client';

import type React from 'react';
import { RejectButton } from '@/app/(main)/statements/components/payables/RejectButton';
import { PrivateAmount } from '@/app/components/ui/private-amount';
import type { SubscriptionChargeCandidates } from '@/app/lib/contracts';

type CandidateRow = SubscriptionChargeCandidates[number];

/** Bank rows that may be a payment of the subscription; one tap links it. */
export function SubscriptionCandidatePicker({
  rows,
  payeeName,
  formatDate,
  money,
  onPick,
  onReject,
}: {
  rows: CandidateRow[];
  payeeName: (name: string) => string;
  formatDate: (value: string) => string;
  money: (amount: number, currency: string) => string;
  onPick: (row: CandidateRow) => void;
  /** "Not this payment"; only on a saved subscription. */
  onReject?: (transactionId: string) => void;
}): React.JSX.Element {
  return (
    <ul className="seneca-sub-payments__picker">
      {rows.map(row => (
        <li key={row.transactionId}>
          <button
            type="button"
            className="seneca-sub-payments__candidate"
            data-match={row.matchesVendor || undefined}
            onClick={() => onPick(row)}
          >
            <span className="seneca-sub-payments__candidate-name">
              {payeeName(row.counterpartyName)}
            </span>
            <span>{formatDate(row.transactionDate)}</span>
            <PrivateAmount>{money(row.amount, row.currency)}</PrivateAmount>
          </button>
          {onReject && <RejectButton id={row.transactionId} onReject={onReject} />}
        </li>
      ))}
    </ul>
  );
}
