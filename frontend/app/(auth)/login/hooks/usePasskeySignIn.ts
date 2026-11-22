'use client';

import { useCallback } from 'react';
import { usePasskeysSupported } from '@/app/hooks/usePasskeysSupported';
import type { AuthUser } from '@/app/lib/contracts';
import { passkeysApi } from '@/app/lib/passkeys-api';
import { getPasskey } from '@/app/lib/webauthn';

/**
 * Sign-in without an e-mail: the server issues a challenge bound to this
 * browser, the authenticator offers its own passkeys, and the signed answer
 * comes back as a session. Throws what the browser or the server refused.
 */
export function usePasskeySignIn(): { supported: boolean; signIn: () => Promise<AuthUser> } {
  const supported = usePasskeysSupported();
  const signIn = useCallback(async (): Promise<AuthUser> => {
    const options = await passkeysApi.signInOptions();
    const result = await passkeysApi.signIn(await getPasskey(options));
    if (!('user' in result)) {
      throw new Error('A passkey sign-in never asks for a second factor');
    }
    return result.user;
  }, []);
  return { supported, signIn };
}
