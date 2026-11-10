'use client';

import { useSyncExternalStore } from 'react';
import { passkeysSupported } from '@/app/lib/webauthn';

const subscribe = () => () => {};

/** Whether the browser can use passkeys; false while rendering on the server. */
export function usePasskeysSupported(): boolean {
  return useSyncExternalStore(subscribe, passkeysSupported, () => false);
}
