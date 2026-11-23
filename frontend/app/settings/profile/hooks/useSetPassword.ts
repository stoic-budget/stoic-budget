'use client';

import { useCallback, useState } from 'react';
import apiClient from '@/app/lib/api';
import { getApiErrorMessage } from '@/app/lib/api-error';
import type { CurrentUser } from '@/app/lib/contracts';
import { type ContractInput, checkContract } from '@/app/lib/query-fn-schema';

const REAUTH_URL = '/auth/oidc/reauth';
const SET_URL = '/auth/password/set';

export type UseSetPasswordReturn = {
  busy: boolean;
  error: string | null;
  /** The password was set on this visit; the form gives way to a note. */
  done: boolean;
  /** Leaves for the provider to sign in again; it sends the browser back here. */
  reauthenticate: () => Promise<void>;
  submit: (newPassword: string) => Promise<void>;
};

/**
 * The first password of an account made by single sign-on: a fresh sign-in at
 * the provider, then the password. The answer is the user with
 * `passwordSet: true`, which `onUser` stores so the security settings switch
 * to the ordinary password change.
 */
export function useSetPassword(
  onUser: (user: CurrentUser) => void,
  messages: { errorFallback: string },
): UseSetPasswordReturn {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const reauthenticate = useCallback(async () => {
    setError(null);
    setBusy(true);
    await (async () => {
      const response = await apiClient.post(REAUTH_URL);
      const { url } = await checkContract('OidcAuthorization', response.data, REAUTH_URL);
      window.location.assign(url);
    })().catch((caught: unknown) => {
      setError(getApiErrorMessage(caught, messages.errorFallback));
      setBusy(false);
    });
  }, [messages.errorFallback]);

  const submit = useCallback(
    async (newPassword: string) => {
      setError(null);
      setBusy(true);
      await (async () => {
        const body = { newPassword } satisfies ContractInput<'SetPasswordBody'>;
        const response = await apiClient.post(SET_URL, body);
        const { user } = await checkContract('UserUpdateResponse', response.data, SET_URL);
        setDone(true);
        onUser(user);
      })()
        .catch((caught: unknown) => setError(getApiErrorMessage(caught, messages.errorFallback)))
        .finally(async () => setBusy(false));
    },
    [messages.errorFallback, onUser],
  );

  return { busy, error, done, reauthenticate, submit };
}
