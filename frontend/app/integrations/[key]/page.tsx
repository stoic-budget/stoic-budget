'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { openAppPanel } from '@/app/components/panels/app-panels-store';
import { buildSettingsHref } from '@/app/settings/profile/helpers/settings-url-state';

/** Connections that moved from the panel to Settings; old links land on their panel there. */
const MOVED_TO_SETTINGS: Record<string, string> = {
  'app-url': buildSettingsHref('data', 'app-url'),
  's3-compatible': buildSettingsHref('sync', 's3-compatible'),
  webdav: buildSettingsHref('sync', 'webdav'),
};

/**
 * Deep link to one integration's settings. Services with a page of their own
 * (bank sync) keep their static route, which Next.js matches before this one.
 */
export default function IntegrationRoute(): null {
  const router = useRouter();
  const params = useParams<{ key: string }>();
  const key = typeof params?.key === 'string' ? params.key : undefined;

  useEffect(() => {
    const moved = key && Object.hasOwn(MOVED_TO_SETTINGS, key) ? MOVED_TO_SETTINGS[key] : undefined;
    if (moved) {
      router.replace(moved);
      return;
    }
    openAppPanel('integrations', key);
    router.replace('/dashboard');
  }, [key, router]);

  return null;
}
