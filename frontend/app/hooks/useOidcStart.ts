import { useCallback, useState } from 'react';
import apiClient from '@/app/lib/api';
import { getApiErrorMessage } from '@/app/lib/api-error';
import { type ContractInput, checkContract } from '@/app/lib/query-fn-schema';

const START_URL = '/auth/oidc/start';

/**
 * Starts a single sign-on: the server stores the request and answers the
 * provider's page, which the browser then opens.
 */
export function useOidcStart(fallbackError: string): {
  start: (nextPath: string | null) => Promise<void>;
  busy: boolean;
  error: string | null;
} {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = useCallback(
    async (nextPath: string | null) => {
      setBusy(true);
      setError(null);
      await (async () => {
        const body = { next: nextPath } satisfies ContractInput<'OidcStartBody'>;
        const response = await apiClient.post(START_URL, body);
        const { url } = await checkContract('OidcAuthorization', response.data, START_URL);
        window.location.assign(url);
      })().catch((caught: unknown) => {
        setError(getApiErrorMessage(caught, fallbackError));
        setBusy(false);
      });
    },
    [fallbackError],
  );

  return { start, busy, error };
}
