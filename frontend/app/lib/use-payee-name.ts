'use client';

import { useIntlayer } from '@/app/i18n';

/**
 * A transaction's counterparty as the reader should see it: a file that named
 * none leaves it empty, and that reads as "Unknown payee" in their language.
 */
export function usePayeeName(): (name: string | null | undefined) => string {
  const t = useIntlayer('payeeName');
  return name => name?.trim() || t.unknownPayee.value;
}
