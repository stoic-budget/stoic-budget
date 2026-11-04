'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';
import { AS_OF_PARAM } from '@/app/lib/as-of-month';

/**
 * Drops `?asOf=` once the page moves off the dashboard's month on its own (a new
 * period picked there), so the strip over it stops naming a month it no longer shows.
 */
export function useClearAsOf(): () => void {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  return useCallback(() => {
    if (!searchParams?.has(AS_OF_PARAM)) {
      return;
    }
    const next = new URLSearchParams(searchParams.toString());
    next.delete(AS_OF_PARAM);
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [router, pathname, searchParams]);
}
