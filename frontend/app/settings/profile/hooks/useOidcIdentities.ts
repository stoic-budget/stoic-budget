'use client';

import { useCallback, useEffect, useState } from 'react';
import apiClient from '@/app/lib/api';
import { getApiErrorMessage } from '@/app/lib/api-error';
import type { OidcIdentity, OidcIdentityList } from '@/app/lib/contracts';
import { apiQueryDecoded, type ContractInput, checkContract } from '@/app/lib/query-fn-schema';

const LIST_URL = '/auth/oidc/identities';
const LINK_URL = '/auth/oidc/link';

export type UseOidcIdentitiesReturn = {
  list: OidcIdentityList | null;
  error: string | null;
  busyId: string | null;
  /** An identity was unlinked since the page opened. */
  unlinked: boolean;
  /** Starts a link after the current password, then leaves for the provider. */
  link: (password: string) => Promise<void>;
  unlink: (identity: OidcIdentity) => Promise<void>;
};

/**
 * The provider accounts linked to the signed-in user. Linking leaves the page
 * for the provider, which sends the browser back to these settings.
 */
export function useOidcIdentities(messages: {
  loadError: string;
  actionError: string;
}): UseOidcIdentitiesReturn {
  const [list, setList] = useState<OidcIdentityList | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [unlinked, setUnlinked] = useState(false);

  useEffect(() => {
    void apiQueryDecoded({ url: LIST_URL, contract: 'OidcIdentityList' })
      .then(setList)
      .catch((caught: unknown) => setError(getApiErrorMessage(caught, messages.loadError)));
  }, [messages.loadError]);

  const link = useCallback(
    async (password: string) => {
      setError(null);
      setBusyId('link');
      await (async () => {
        const body = { password } satisfies ContractInput<'OidcLinkBody'>;
        const response = await apiClient.post(LINK_URL, body);
        const { url } = await checkContract('OidcAuthorization', response.data, LINK_URL);
        window.location.assign(url);
      })().catch((caught: unknown) => {
        setError(getApiErrorMessage(caught, messages.actionError));
        setBusyId(null);
      });
    },
    [messages.actionError],
  );

  const unlink = useCallback(
    async (identity: OidcIdentity) => {
      const url = `${LIST_URL}/${identity.id}`;
      setError(null);
      setBusyId(identity.id);
      await (async () => {
        const response = await apiClient.delete(url);
        setList(await checkContract('OidcIdentityList', response.data, url));
        setUnlinked(true);
      })()
        .catch((caught: unknown) => setError(getApiErrorMessage(caught, messages.actionError)))
        .finally(async () => setBusyId(null));
    },
    [messages.actionError],
  );

  return { list, error, busyId, unlinked, link, unlink };
}
