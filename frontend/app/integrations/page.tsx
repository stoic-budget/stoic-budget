'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { openAppPanel } from '@/app/components/panels/app-panels-store';

/**
 * Integrations live in the plugins panel now. The route stays for deep links —
 * tours, docs, old bookmarks — and opens that panel over the dashboard.
 */
export default function IntegrationsRoute(): null {
  const router = useRouter();

  useEffect(() => {
    openAppPanel('plugins');
    router.replace('/dashboard');
  }, [router]);

  return null;
}
