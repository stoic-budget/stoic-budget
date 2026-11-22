import { useCallback, useEffect, useRef, useState } from 'react';
import apiClient from '@/app/lib/api';
import { getApiErrorMessage } from '@/app/lib/api-error';
import type { AuthUser } from '@/app/lib/contracts';
import { type ContractInput, checkContract } from '@/app/lib/query-fn-schema';

const COMPLETE_URL = '/auth/oidc/complete';

export type OidcCompletionState =
  | { step: 'working' }
  | { step: 'code'; error: string | null }
  | { step: 'failed'; error: string };

/**
 * Finishes a single sign-on once the provider sent the browser back: the
 * server holds the checked sign-in behind an httpOnly cookie, and answers
 * with the user, or asks for the account's second factor first.
 */
export function useOidcCompletion(
  onSignedIn: (user: AuthUser) => void,
  fallbackError: string,
): { state: OidcCompletionState; submitCode: (code: string) => Promise<void> } {
  const [state, setState] = useState<OidcCompletionState>({ step: 'working' });
  const started = useRef(false);

  const send = useCallback(
    async (twoFactorCode?: string) => {
      const body = (
        twoFactorCode ? { twoFactorCode } : {}
      ) satisfies ContractInput<'OidcCompleteBody'>;
      await (async () => {
        const response = await apiClient.post(COMPLETE_URL, body);
        const result = await checkContract('LoginResponse', response.data, COMPLETE_URL);
        if ('twoFactorRequired' in result) {
          setState({ step: 'code', error: null });
          return;
        }
        onSignedIn(result.user);
      })().catch((error: unknown) => {
        const message = getApiErrorMessage(error, fallbackError);
        // A wrong code may be typed again; anything else ends this sign-in.
        setState(current =>
          twoFactorCode && current.step === 'code'
            ? { step: 'code', error: message }
            : { step: 'failed', error: message },
        );
      });
    },
    [onSignedIn, fallbackError],
  );

  useEffect(() => {
    // Once: a second request would find the sign-in already spent.
    if (started.current) return;
    started.current = true;
    void send();
  }, [send]);

  const submitCode = useCallback(
    async (code: string) => {
      setState({ step: 'code', error: null });
      await send(code.trim());
    },
    [send],
  );

  return { state, submitCode };
}
