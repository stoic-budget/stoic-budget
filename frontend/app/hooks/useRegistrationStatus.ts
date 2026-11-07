import { useCallback, useEffect, useState } from 'react';
import apiClient from '@/app/lib/api';
import { apiQueryDecoded, type ContractInput, checkContract } from '@/app/lib/query-fn-schema';

const STATUS_URL = '/auth/registration';
const SAVE_URL = '/settings/instance/registration';

/**
 * Whether someone without an invitation can sign up: null until known. If it
 * cannot be read the pages behave as open, and the server still refuses when closed.
 */
export function useRegistrationStatus(): {
  open: boolean | null;
  save: (open: boolean) => Promise<void>;
} {
  const [open, setOpen] = useState<boolean | null>(null);

  useEffect(() => {
    void apiQueryDecoded({ url: STATUS_URL, contract: 'RegistrationStatus' })
      .then(status => setOpen(status.open))
      .catch(() => undefined);
  }, []);

  const save = useCallback(async (next: boolean) => {
    const response = await apiClient.put(SAVE_URL, {
      open: next,
    } satisfies ContractInput<'SaveRegistrationBody'>);
    const status = await checkContract('RegistrationStatus', response.data, SAVE_URL);
    setOpen(status.open);
  }, []);

  return { open, save };
}
