import { useCallback, useEffect, useState } from 'react';
import apiClient from '@/app/lib/api';
import { apiQueryDecoded, type ContractInput, checkContract } from '@/app/lib/query-fn-schema';

const SETTINGS_URL = '/settings/instance/mcp-oauth-registration';

/** Whether MCP apps may register themselves for OAuth: null until known. Instance admins only. */
export function useMcpClientRegistration(): {
  open: boolean | null;
  save: (open: boolean) => Promise<void>;
} {
  const [open, setOpen] = useState<boolean | null>(null);

  useEffect(() => {
    void apiQueryDecoded({ url: SETTINGS_URL, contract: 'RegistrationStatus' })
      .then(status => setOpen(status.open))
      .catch(() => undefined);
  }, []);

  const save = useCallback(async (next: boolean) => {
    const response = await apiClient.put(SETTINGS_URL, {
      open: next,
    } satisfies ContractInput<'SaveRegistrationBody'>);
    const status = await checkContract('RegistrationStatus', response.data, SETTINGS_URL);
    setOpen(status.open);
  }, []);

  return { open, save };
}
