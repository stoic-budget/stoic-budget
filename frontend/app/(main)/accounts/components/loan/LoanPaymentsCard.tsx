'use client';

import Button from '@mui/material/Button';
import { useState } from 'react';
import { ReadOnlyHint } from '@/app/components/versions/ReadOnlyHint';
import { useIntlayer } from '@/app/i18n';
import type { LoanPaymentItem } from '@/app/lib/contracts';
import { useLoanPaymentMutations, useLoanPayments } from '../../hooks/useLoanPayments';
import {
  cardStyle,
  figureStyle,
  formatDay,
  listRowStyle,
  mutedStyle,
  titleStyle,
} from '../account-detail-styles';
import { LoanPaymentSplitDialog } from './LoanPaymentSplitDialog';
import { paymentState } from './loan-payment-split';

/** Enough to see the last months at a glance; the rest one click away. */
const SHOWN = 6;

/**
 * The payments into a loan account. Split, a payment's interest is spending
 * and only its principal lowers the debt; the account's standing against the
 * schedule (on the terms card) follows.
 */
export function LoanPaymentsCard({
  walletId,
  money,
  locale,
}: {
  walletId: string;
  money: (value: number) => string;
  locale: string;
}): React.JSX.Element | null {
  const t = useIntlayer('loanPayments');
  const { payments } = useLoanPayments(walletId, true);
  const mutations = useLoanPaymentMutations(walletId, t.failed.value);
  const [openId, setOpenId] = useState<string | null>(null);
  const [all, setAll] = useState(false);

  if (!payments) {
    return null;
  }
  // The row as the list has it now, never a copy taken when the dialog opened.
  const open = payments.items.find(item => item.transactionId === openId) ?? null;
  const shown = all ? payments.items : payments.items.slice(0, SHOWN);
  const { totals } = payments;

  const describe = (item: LoanPaymentItem): string => {
    const state = paymentState(item);
    const parts = (interest: number, principal: number) =>
      [money(interest), money(principal)] as const;
    let text: string;
    if (state.kind === 'split' || state.kind === 'suggested') {
      const [interest, principal] = parts(state.interest, state.principal);
      text = (state.kind === 'split' ? t.splitInfo : t.suggested).value
        .replace('{{interest}}', interest)
        .replace('{{principal}}', principal);
    } else if (state.kind === 'blocked') {
      text = {
        other_currency: t.blockedCurrency.value,
        before_start: t.blockedBeforeStart.value,
        split_part: t.blockedSplitPart.value,
      }[state.reason];
    } else {
      text = t.extraPayment.value;
    }
    return item.isVerified ? text : `${text} · ${t.inReview.value}`;
  };

  return (
    <section style={cardStyle}>
      <h2 style={titleStyle}>{t.title}</h2>
      <span style={mutedStyle}>{t.hint}</span>
      {(totals.interest > 0 || totals.unsplit > 0) && (
        <span style={{ ...mutedStyle, fontVariantNumeric: 'tabular-nums' }}>
          {[
            totals.interest > 0 || totals.principal > 0
              ? t.totals.value
                  .replace('{{interest}}', money(totals.interest))
                  .replace('{{principal}}', money(totals.principal))
              : null,
            totals.unsplit > 0
              ? t.unsplit.value.replace('{{count}}', String(totals.unsplit))
              : null,
          ]
            .filter(Boolean)
            .join(' · ')}
        </span>
      )}
      {payments.items.length === 0 ? (
        <span style={mutedStyle}>{t.empty}</span>
      ) : (
        <div>
          {shown.map(item => (
            <div key={item.transactionId} style={{ ...listRowStyle, flexWrap: 'wrap' }}>
              <div style={{ display: 'grid', gap: 2, minWidth: 0, flex: '1 1 220px' }}>
                <span style={{ fontSize: 14, color: 'var(--foreground)' }}>
                  {formatDay(item.date, locale)}
                  {' · '}
                  {item.fromWallet?.name ?? item.counterpartyName}
                </span>
                <span style={mutedStyle}>{describe(item)}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
                <span style={figureStyle}>{money(item.amount)}</span>
                <ReadOnlyHint>
                  {item.split ? (
                    <Button
                      variant="text"
                      size="small"
                      disabled={mutations.pending}
                      onClick={() => void mutations.rejoin(item.transactionId)}
                    >
                      {t.rejoin}
                    </Button>
                  ) : (
                    <Button
                      variant="text"
                      size="small"
                      disabled={item.blocked !== null}
                      onClick={() => setOpenId(item.transactionId)}
                    >
                      {t.split}
                    </Button>
                  )}
                </ReadOnlyHint>
              </div>
            </div>
          ))}
          {!all && payments.items.length > SHOWN && (
            <Button variant="text" size="small" onClick={() => setAll(true)}>
              {t.showAll}
            </Button>
          )}
        </div>
      )}
      <LoanPaymentSplitDialog
        item={open && !open.split ? open : null}
        saving={mutations.pending}
        money={money}
        onClose={() => setOpenId(null)}
        onSave={interest =>
          void mutations
            .split(open?.transactionId ?? '', interest)
            .then(ok => ok && setOpenId(null))
        }
      />
    </section>
  );
}
