'use client';

import { useQuery } from '@tanstack/react-query';
import { passkeysApi } from '@/app/lib/passkeys-api';

/**
 * The passkeys of the account the reset link belongs to. A bad link answers
 * the same error the reset gives, and the page then lists nothing: the submit
 * reports the link.
 */
export function useResetPasskeys(token: string | null) {
  const query = useQuery({
    queryKey: ['auth', 'reset-password', 'passkeys', token],
    queryFn: () => passkeysApi.listForReset(token ?? ''),
    enabled: Boolean(token),
    retry: false,
    staleTime: Number.POSITIVE_INFINITY,
  });
  return query.data ?? [];
}
