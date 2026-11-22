import { useCallback, useEffect, useState } from 'react';
import apiClient from '@/app/lib/api';
import type { OidcSettingsStatus } from '@/app/lib/contracts';
import { apiQueryDecoded, type ContractInput, checkContract } from '@/app/lib/query-fn-schema';

const SETTINGS_URL = '/settings/instance/oidc';

/** The server's OpenID Connect provider, for instance administrators; null until loaded. */
export function useOidcSettings(): {
  status: OidcSettingsStatus | null;
  save: (body: ContractInput<'SaveOidcSettingsBody'>) => Promise<OidcSettingsStatus>;
  remove: () => Promise<OidcSettingsStatus>;
} {
  const [status, setStatus] = useState<OidcSettingsStatus | null>(null);

  useEffect(() => {
    void apiQueryDecoded({ url: SETTINGS_URL, contract: 'OidcSettingsStatus' })
      .then(setStatus)
      .catch(() => undefined);
  }, []);

  const save = useCallback(async (body: ContractInput<'SaveOidcSettingsBody'>) => {
    const response = await apiClient.put(SETTINGS_URL, body);
    const saved = await checkContract('OidcSettingsStatus', response.data, SETTINGS_URL);
    setStatus(saved);
    return saved;
  }, []);

  const remove = useCallback(async () => {
    const response = await apiClient.delete(SETTINGS_URL);
    const cleared = await checkContract('OidcSettingsStatus', response.data, SETTINGS_URL);
    setStatus(cleared);
    return cleared;
  }, []);

  return { status, save, remove };
}
