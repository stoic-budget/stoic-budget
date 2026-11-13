'use client';

import Typography from '@mui/material/Typography';
import Link from 'next/link';
import type React from 'react';
import { useIntlayer } from '@/app/i18n';

/**
 * How many accounts are set not to count in net worth, and where to change it.
 * Said quietly, but said: a figure that leaves money out without a word reads
 * as money that went missing.
 */
export function LeftOutAccountsNote({ count }: { count: number }): React.JSX.Element | null {
  const t = useIntlayer('netWorthPage');
  if (count === 0) {
    return null;
  }
  return (
    <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
      {t.accountsLeftOut.value.replace('{{count}}', String(count))}{' '}
      <Link href="/accounts" style={{ color: 'var(--primary)' }}>
        {t.accountsLeftOutChange}
      </Link>
    </Typography>
  );
}
