'use client';

import { Box, Button, TextField } from '@mui/material';
import CircularProgress from '@mui/material/CircularProgress';
import NextLink from 'next/link';
import type React from 'react';
import { useCallback, useState } from 'react';
import { useOidcCompletion } from '@/app/hooks/useOidcCompletion';
import { useIntlayer } from '@/app/i18n';
import type { AuthUser } from '@/app/lib/contracts';
import { finishSignIn } from '@/app/lib/finish-sign-in';

/**
 * The login page after the provider sent the browser back: signs in, asking
 * for the account's own second factor when it has one.
 */
export function OidcCompletion({
  nextPath,
  inviteToken,
}: {
  nextPath: string | null;
  inviteToken: string | null;
}): React.JSX.Element {
  const t = useIntlayer('oidcSignIn');
  const login = useIntlayer('loginPage');
  const [code, setCode] = useState('');
  const [sending, setSending] = useState(false);
  const signedIn = useCallback(
    (user: AuthUser) => finishSignIn(user, { inviteToken, nextPath }),
    [inviteToken, nextPath],
  );
  const { state, submitCode } = useOidcCompletion(signedIn, t.failed.value);

  const submit = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    setSending(true);
    await submitCode(code).finally(async () => setSending(false));
  };

  if (state.step === 'working') {
    return (
      <p role="status" className="seneca-auth-footnote">
        <CircularProgress size={16} color="inherit" sx={{ mr: 1, verticalAlign: 'middle' }} />
        {t.completing}
      </p>
    );
  }
  if (state.step === 'failed') {
    return (
      <>
        <p role="alert" className="seneca-auth-error seneca-auth-error--block">
          {state.error}
        </p>
        <p className="seneca-auth-footnote">
          <NextLink href="/login" className="seneca-auth-link seneca-auth-link--accent">
            {t.backToPassword}
          </NextLink>
        </p>
      </>
    );
  }
  return (
    <Box component="form" onSubmit={submit} className="seneca-auth-form" sx={{ width: '100%' }}>
      <div className="seneca-auth-field">
        <label htmlFor="oidcTwoFactorCode" className="seneca-auth-field__label">
          {login.twoFactorLabel}
        </label>
        <TextField
          required
          fullWidth
          id="oidcTwoFactorCode"
          name="twoFactorCode"
          autoComplete="one-time-code"
          autoFocus
          value={code}
          onChange={event => setCode(event.target.value)}
          error={Boolean(state.error)}
          slotProps={{ htmlInput: { maxLength: 64 } }}
        />
        {state.error ? (
          <p role="alert" className="seneca-auth-error">
            {state.error}
          </p>
        ) : (
          <p className="seneca-auth-field__hint">{login.twoFactorHint}</p>
        )}
      </div>
      <Button
        type="submit"
        fullWidth
        variant="contained"
        size="large"
        className="seneca-auth-submit"
        disabled={sending}
      >
        {sending ? <CircularProgress size={24} color="inherit" /> : t.continue}
      </Button>
    </Box>
  );
}
