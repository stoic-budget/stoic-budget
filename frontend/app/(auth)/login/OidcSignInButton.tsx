'use client';

import { Button } from '@mui/material';
import { useSearchParams } from 'next/navigation';
import type React from 'react';
import { useOidcStart } from '@/app/hooks/useOidcStart';
import { useOidcStatus } from '@/app/hooks/useOidcStatus';
import { useIntlayer } from '@/app/i18n';
import { oidcErrorMessage } from '@/app/lib/oidc-error';

/**
 * "or" and the single sign-on button, only when the server offers it. A
 * failed sign-in comes back as `?oidcError=<code>` and is told here, in the
 * person's language; the code alone travels in the link.
 */
export function OidcSignInButton({
  nextPath,
}: {
  nextPath: string | null;
}): React.JSX.Element | null {
  const t = useIntlayer('oidcSignIn');
  const status = useOidcStatus();
  const { start, busy, error: startError } = useOidcStart(t.failed.value);
  const returnedCode = useSearchParams().get('oidcError');
  const error = startError ?? oidcErrorMessage(returnedCode, t.failed.value);

  if (!(status?.enabled || error)) return null;
  return (
    <>
      {error ? (
        <p role="alert" className="seneca-auth-error seneca-auth-error--block">
          {error}
        </p>
      ) : null}
      {status?.enabled ? (
        <>
          <div className="seneca-auth-divider">{t.or}</div>
          <Button
            type="button"
            fullWidth
            variant="outlined"
            size="large"
            className="seneca-auth-sso"
            disabled={busy}
            onClick={() => void start(nextPath)}
          >
            {status.buttonLabel || t.defaultButton}
          </Button>
        </>
      ) : null}
    </>
  );
}
