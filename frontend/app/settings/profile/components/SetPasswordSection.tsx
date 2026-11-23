'use client';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useSearchParams } from 'next/navigation';
import { type FormEvent, useState } from 'react';
import { Alert } from '@/app/components/ui/alert';
import { Spinner } from '@/app/components/ui/spinner';
import { useIntlayer } from '@/app/i18n';
import { oidcErrorMessage } from '@/app/lib/oidc-error';
import type { Tx } from '@/app/settings/profile/components/TwoFactorPanels';
import type { UseSetPasswordReturn } from '@/app/settings/profile/hooks/useSetPassword';

const labelSx = { fontSize: 14, fontWeight: 500 } as const;

/**
 * The password panel of an account made by single sign-on, which has none:
 * sign in at the provider again, come back here, choose the password. The
 * provider sends the browser back with `?reauth=ok`, or `?reauthError=CODE`.
 */
export function SetPasswordSection({
  tx,
  setPassword,
}: {
  tx: Tx;
  setPassword: UseSetPasswordReturn;
}): React.JSX.Element {
  const t = useIntlayer('setPasswordSection');
  const params = useSearchParams();
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [mismatch, setMismatch] = useState(false);
  const { busy, error, done, reauthenticate, submit } = setPassword;
  const returned = params.get('reauth') === 'ok';
  const returnedError = oidcErrorMessage(params.get('reauthError'), t.errorFallback.value);

  if (done) return <Alert variant="success">{t.doneMessage}</Alert>;

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    setMismatch(next !== confirm);
    if (next === confirm) void submit(next);
  };
  const shownError = mismatch ? tx(['validation', 'passwordMismatch']) : (error ?? returnedError);

  return (
    <Stack spacing={2}>
      {shownError ? <Alert variant="error">{shownError}</Alert> : null}
      {returned ? (
        <Box component="form" onSubmit={handleSubmit} sx={{ display: 'grid', gap: 2 }}>
          <Typography sx={{ fontSize: 14, color: 'var(--text-muted)' }}>
            {t.returnedNote}
          </Typography>
          <Stack spacing={0.5}>
            <Typography component="label" htmlFor="set-password-next" sx={labelSx}>
              {tx(['passwordCard', 'newPasswordLabel'])}
            </Typography>
            <TextField
              id="set-password-next"
              type="password"
              size="small"
              autoComplete="new-password"
              value={next}
              onChange={event => setNext(event.target.value)}
              required
              fullWidth
            />
            <Typography sx={{ fontSize: 13, color: 'var(--text-muted)' }}>
              {tx(['passwordCard', 'newPasswordHelp'])}
            </Typography>
          </Stack>
          <Stack spacing={0.5}>
            <Typography component="label" htmlFor="set-password-confirm" sx={labelSx}>
              {tx(['passwordCard', 'confirmPasswordLabel'])}
            </Typography>
            <TextField
              id="set-password-confirm"
              type="password"
              size="small"
              autoComplete="new-password"
              value={confirm}
              onChange={event => setConfirm(event.target.value)}
              required
              fullWidth
            />
          </Stack>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 1 }}>
            <Button
              disabled={busy}
              onClick={() => void reauthenticate()}
              sx={{ textTransform: 'none', color: 'var(--text-muted)' }}
            >
              {t.restart}
            </Button>
            <Button
              type="submit"
              variant="contained"
              color="secondary"
              disabled={busy || !next || !confirm}
              startIcon={busy ? <Spinner size={16} /> : undefined}
            >
              {t.submit}
            </Button>
          </Box>
        </Box>
      ) : (
        <>
          <Typography sx={{ fontSize: 14 }}>{t.intro}</Typography>
          <Typography sx={{ fontSize: 13, color: 'var(--text-muted)' }}>{t.steps}</Typography>
          <Box>
            <Button
              variant="contained"
              color="secondary"
              disabled={busy}
              onClick={() => void reauthenticate()}
              startIcon={busy ? <Spinner size={16} /> : undefined}
              sx={{ textTransform: 'none' }}
            >
              {t.start}
            </Button>
          </Box>
        </>
      )}
    </Stack>
  );
}
