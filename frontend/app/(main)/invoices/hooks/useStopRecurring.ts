import { useState } from 'react';
import toast from 'react-hot-toast';
import { useIntlayer } from '@/app/i18n';
import { getApiErrorMessage } from '@/app/lib/api-error';
import { type Invoice, invoicesApi } from '@/app/lib/invoices-api';

/** Ends an invoice's series after the person confirms; `onStopped` gets the invoice as it is now. */
export function useStopRecurring(onStopped: (invoice: Invoice) => void) {
  const t = useIntlayer('invoicesPage');
  const [stopping, setStopping] = useState(false);

  const stop = async (invoice: Invoice): Promise<void> => {
    if (!window.confirm(t.detail.stopRecurringConfirm.value)) {
      return;
    }
    setStopping(true);
    await invoicesApi
      .stopRecurring(invoice.id)
      .then(updated => {
        onStopped(updated);
        toast.success(t.detail.stopRecurringDone.value);
      })
      .catch(error => toast.error(getApiErrorMessage(error, t.toasts.genericFailed.value)))
      .finally(() => setStopping(false));
  };

  return { stop, stopping };
}
