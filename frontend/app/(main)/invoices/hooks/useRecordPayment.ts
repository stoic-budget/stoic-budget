import { useCallback, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import type { MarkPaidResult } from '@/app/(main)/statements/components/payables/MarkPaidDialog';
import { getApiErrorMessage } from '@/app/lib/api-error';
import { type Payable, payablesApi } from '@/app/lib/payables-api';

/**
 * Records a payment from the invoice's "Record payment" dialog, once: a second
 * click while the first is on its way is ignored, and `paying` disables the
 * dialog's buttons meanwhile. A bill still short keeps the dialog open.
 */
export function useRecordPayment(
  setPayingPayable: (payable: Payable | null) => void,
  reload: () => Promise<unknown>,
  failedText: string,
) {
  const [paying, setPaying] = useState(false);
  const inFlight = useRef(false);

  const confirm = useCallback(
    async (payable: Payable, result: MarkPaidResult): Promise<void> => {
      if (inFlight.current) return;
      inFlight.current = true;
      setPaying(true);
      await (result.kind === 'full'
        ? payablesApi.markAsPaid(payable.id, result.payload)
        : result.kind === 'book'
          ? payablesApi.bookPayment(payable.id, result.paymentId, result.payload)
          : payablesApi.addPayment(payable.id, result.payload)
      )
        .then(async updated => {
          // Still short: the dialog stays open for the next instalment.
          setPayingPayable(updated.status === 'partially_paid' ? updated : null);
          await reload();
        })
        .catch(error => toast.error(getApiErrorMessage(error, failedText)))
        .finally(() => {
          inFlight.current = false;
          setPaying(false);
        });
    },
    [setPayingPayable, reload, failedText],
  );

  return { paying, confirm };
}
