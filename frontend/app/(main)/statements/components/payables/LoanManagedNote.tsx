'use client';

import Link from 'next/link';
import type React from 'react';
import { useIntlayer } from '@/app/i18n';

/** In place of the repeat fields: a loan's bill repeats and reminds as its terms say. */
export function LoanManagedNote({ loanWalletId }: { loanWalletId: string }): React.JSX.Element {
  const t = useIntlayer('payableRecurrence');
  return (
    <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>
      {t.loanManaged}{' '}
      <Link href={`/accounts/${loanWalletId}`} style={{ color: 'var(--primary)' }}>
        {t.openLoan}
      </Link>
    </p>
  );
}
