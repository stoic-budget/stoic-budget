'use client';

import { useIntlayer } from '@/app/i18n';
import { FilteredTransactions } from '../../transactions/components/FilteredTransactions';

/** The payee's rows, as All transactions lists them. */
export function PayeeTransactions({ payeeId }: { payeeId: string }): React.JSX.Element {
  const t = useIntlayer('payeesPage');
  return (
    <FilteredTransactions
      filter={{ payeeId }}
      title={t.transactionsTitle}
      empty={t.noTransactions}
    />
  );
}
