import { useEffect, useState } from 'react';
import type { OidcPublicStatus } from '@/app/lib/contracts';
import { apiQueryDecoded } from '@/app/lib/query-fn-schema';

/**
 * Whether the server offers single sign-on, for the login page: null until
 * known, and treated as off when it cannot be read.
 */
export function useOidcStatus(): OidcPublicStatus | null {
  const [status, setStatus] = useState<OidcPublicStatus | null>(null);

  useEffect(() => {
    void apiQueryDecoded({ url: '/auth/oidc/status', contract: 'OidcPublicStatus' })
      .then(setStatus)
      .catch(() => setStatus({ enabled: false, buttonLabel: null }));
  }, []);

  return status;
}
