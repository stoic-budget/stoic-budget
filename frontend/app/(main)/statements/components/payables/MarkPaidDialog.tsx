'use client';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Button } from '@/app/components/ui/button';
import { ModalShell } from '@/app/components/ui/modal-shell';
import { PrivateAmount } from '@/app/components/ui/private-amount';
import { useWorkspaceId } from '@/app/hooks/useWorkspaceId';
import { useIntlayer, useLocale } from '@/app/i18n';
import { formatMoney } from '@/app/lib/format-money';
import type { LateReason } from '@/app/lib/late-reasons-api';
import { type Payable, type PayablePayment, payablesApi } from '@/app/lib/payables-api';
import { queryKeys } from '@/app/lib/query-keys';
import { useCashPaymentOptions } from './hooks/useCashPaymentOptions';
import { usePayableMatchRejection } from './hooks/usePayableMatchRejection';
import { LateReasonPicker } from './LateReasonPicker';
import { paidLate } from './late-reason-utils';
import {
  AmountFields,
  type AmountState,
  CandidateList,
  CashFields,
  IN_HAND,
  PaymentLog,
  today,
} from './MarkPaidFields';
import {
  buildBooking,
  buildResult,
  type CashState,
  type MarkPaidResult,
  type Mode,
} from './mark-paid-result';

export type { MarkPaidResult } from './mark-paid-result';

type MarkPaidDialogProps = {
  /** The bill being settled; the dialog is closed while null. */
  payable: Payable | null;
  submitting: boolean;
  removingPaymentId?: string | null;
  onClose: () => void;
  onConfirm: (payable: Payable, result: MarkPaidResult) => void;
  onRemovePayment: (payable: Payable, paymentId: string) => void;
};

/**
 * Settles a bill three ways: against a transaction already on a statement,
 * as a cash payment the server records in a wallet, or as a bare status
 * change. Only the first two reach the books.
 */
export function MarkPaidDialog(props: MarkPaidDialogProps): React.JSX.Element | null {
  if (!props.payable) {
    return null;
  }
  // Keyed so that every bill opens with a fresh form.
  return <MarkPaidForm {...props} key={props.payable.id} payable={props.payable} />;
}

/** What the dialog offers for this bill: matching payments, wallets and categories. */
function usePaymentOptions(payable: Payable) {
  const workspaceId = useWorkspaceId();
  const currency = payable.currency.toUpperCase();
  const cash = useCashPaymentOptions({ currency, direction: payable.direction });

  const candidates = useQuery({
    queryKey: queryKeys.payablePaymentCandidates({ workspaceId, payableId: payable.id }),
    queryFn: () => payablesApi.paymentCandidates(payable.id),
    enabled: Boolean(workspaceId),
  });
  const payments = useQuery({
    queryKey: queryKeys.payablePayments({ workspaceId, payableId: payable.id }),
    queryFn: () => payablesApi.payments(payable.id),
    enabled: Boolean(workspaceId),
  });
  return {
    currency,
    candidates: candidates.data ?? [],
    candidatesLoading: candidates.isPending,
    payments: (payments.data ?? []) as PayablePayment[],
    ...cash,
  };
}

function MarkPaidForm({
  payable,
  submitting,
  removingPaymentId,
  onClose,
  onConfirm,
  onRemovePayment,
}: MarkPaidDialogProps & { payable: Payable }): React.JSX.Element {
  const t = useIntlayer('payableMarkPaid');
  const unbookedText = useIntlayer('payablesUnbooked');
  const { locale } = useLocale();
  const options = usePaymentOptions(payable);

  const [chosenMode, setMode] = useState<Mode | null>(null);
  const [transactionId, setTransactionId] = useState<string | null>(null);
  const rejection = usePayableMatchRejection(payable.id);
  const [cash, setCash] = useState<CashState>({ walletId: null, paidOn: today(), categoryId: '' });
  const [amount, setAmount] = useState<AmountState | null>(null);
  const [lateReason, setLateReason] = useState<LateReason | null>(null);

  const total = Number(payable.amount);
  const paidSoFar = Math.round(Number(payable.paidAmount ?? 0) * 100) / 100;
  const outstanding = Math.round((total - paidSoFar) * 100) / 100;
  // The form opens on the rest of the bill; the amount follows it until typed in.
  const amountState = amount ?? { amount: outstanding.toFixed(2), feeAmount: '' };

  // Until the user picks, open on the bank match when there is one to pick,
  // with the first candidate and the first wallet preselected.
  // Nothing left to pay, but a payment has no money in an account yet: the
  // dialog asks where that money went instead of for another payment.
  const unbooked =
    outstanding <= 0.005 ? options.payments.find(payment => !payment.transactionId) : undefined;
  const fallbackMode: Mode = options.candidates.length > 0 ? 'match' : unbooked ? 'cash' : 'plain';
  const mode: Mode =
    unbooked && chosenMode === 'plain' ? fallbackMode : (chosenMode ?? fallbackMode);
  // No wallet in the bill's currency: cash in hand is what is left, and it is preselected.
  const selectedCash = {
    ...cash,
    walletId: cash.walletId ?? options.wallets[0]?.id ?? (options.walletsLoading ? null : IN_HAND),
  };
  // A bill already linked (paid, then marked unpaid) keeps its payment unless the user picks another.
  const defaultTransaction =
    options.candidates.find(candidate => candidate.id === payable.linkedTransactionId)?.id ??
    options.candidates[0]?.id ??
    null;
  // Paid after its due date, by the day the payment carries: the dialog asks why.
  // Booking keeps the day already recorded; it only says where the money went.
  const paidOn = unbooked
    ? unbooked.paidOn
    : mode === 'cash'
      ? selectedCash.paidOn
      : mode === 'match'
        ? options.candidates.find(c => c.id === (transactionId ?? defaultTransaction))
            ?.transactionDate
        : today();
  const late = paidLate(payable, paidOn);
  const result = unbooked
    ? buildBooking(mode, unbooked.id, {
        transactionId: transactionId ?? defaultTransaction,
        cash: selectedCash,
      })
    : buildResult(mode, {
        transactionId: transactionId ?? defaultTransaction,
        cash: selectedCash,
        amount: amountState,
        outstanding,
      });

  return (
    <ModalShell
      isOpen
      onClose={onClose}
      size="sm"
      title={payable.direction === 'receivable' ? t.titleReceived.value : t.titlePaid.value}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            {t.cancel.value}
          </Button>
          <Button
            onClick={() =>
              result && onConfirm(payable, late && lateReason ? { ...result, lateReason } : result)
            }
            disabled={!result || submitting}
          >
            {t.confirm.value}
          </Button>
        </>
      }
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          {payable.vendor} ·{' '}
          <PrivateAmount>{formatMoney(total, options.currency, locale)}</PrivateAmount>
        </Typography>

        <PaymentLog
          payments={options.payments}
          currency={options.currency}
          locale={locale}
          removingId={removingPaymentId ?? null}
          onRemove={paymentId => onRemovePayment(payable, paymentId)}
        />

        {unbooked ? (
          <Alert severity="info">{unbookedText.bookIntro.value}</Alert>
        ) : (
          <AmountFields
            currency={options.currency}
            locale={locale}
            paidSoFar={paidSoFar}
            outstanding={outstanding}
            value={amountState}
            onChange={setAmount}
          />
        )}

        <ToggleButtonGroup
          exclusive
          size="small"
          value={mode}
          onChange={(_event, next: Mode | null) => next && setMode(next)}
          sx={{ flexWrap: 'wrap' }}
        >
          <ToggleButton value="match" sx={{ textTransform: 'none' }}>
            {t.modeMatch.value}
          </ToggleButton>
          <ToggleButton value="cash" sx={{ textTransform: 'none' }}>
            {t.modeCash.value}
          </ToggleButton>
          {!unbooked && (
            <ToggleButton value="plain" sx={{ textTransform: 'none' }}>
              {t.modePlain.value}
            </ToggleButton>
          )}
        </ToggleButtonGroup>

        {mode === 'match' && (
          <CandidateList
            candidates={options.candidates}
            loading={options.candidatesLoading}
            selected={transactionId ?? defaultTransaction}
            onSelect={setTransactionId}
            onReject={id => {
              if (transactionId === id) setTransactionId(null);
              rejection.reject(id);
            }}
            locale={locale}
          />
        )}
        {mode === 'cash' && (
          <CashFields
            wallets={options.wallets}
            categories={options.categories}
            value={selectedCash}
            onChange={setCash}
            hideDate={Boolean(unbooked)}
          />
        )}
        {mode === 'plain' && <Alert severity="warning">{t.plainHint.value}</Alert>}
        {late && <LateReasonPicker value={lateReason} onChange={setLateReason} />}
      </Box>
    </ModalShell>
  );
}
