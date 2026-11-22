'use client';

import { Box, Button, Paper, Skeleton, Stack, Switch, TextField, Typography } from '@mui/material';
import type React from 'react';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useIntlayer } from '@/app/i18n';
import { getApiErrorMessage } from '@/app/lib/api-error';
import { useOidcSettings } from '../hooks/useOidcSettings';
import {
  bodyFromForm,
  formFromStatus,
  formProblem,
  LIMITS,
  type OidcSettingsForm,
  secretKept,
} from '../lib/oidc-settings-form';

const labelSx = { fontSize: 13, fontWeight: 500, color: 'var(--text-muted)' };
const hintSx = { fontSize: 13, color: 'var(--text-muted)' };

/** The server's single sign-on provider. The client secret is write-only. */
export function OidcSettingsCard(): React.JSX.Element {
  const t = useIntlayer('oidcSettingsCard');
  const { status, save, remove } = useOidcSettings();
  const [form, setForm] = useState<OidcSettingsForm | null>(null);
  const [busy, setBusy] = useState(false);

  // The form shows what is stored: after a load or a save, never stale input.
  useEffect(() => {
    if (status) setForm(formFromStatus(status));
  }, [status]);

  if (!(status && form)) {
    return (
      <Paper sx={{ mt: 3, p: 3 }}>
        <Skeleton width={260} />
        <Skeleton width={360} />
      </Paper>
    );
  }

  const set = <K extends keyof OidcSettingsForm>(key: K, value: OidcSettingsForm[K]) =>
    setForm(current => (current ? { ...current, [key]: value } : current));
  const problem = formProblem(form);

  const run = async (action: () => Promise<unknown>, done: string) => {
    setBusy(true);
    await action()
      .then(() => toast.success(done))
      .catch(async (error: unknown) => toast.error(getApiErrorMessage(error, t.saveFailed.value)))
      .finally(async () => setBusy(false));
  };
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!problem) void run(() => save(bodyFromForm(form)), t.saved.value);
  };
  const clear = () => {
    if (window.confirm(t.removeConfirm.value)) void run(remove, t.removed.value);
  };

  const field = (
    key: 'issuer' | 'clientId' | 'clientSecret' | 'buttonLabel' | 'extraScopes' | 'allowedDomains',
    label: string,
    hint?: string,
    extra: { type?: string; placeholder?: string; maxLength?: number } = {},
  ) => (
    <Box>
      <Typography component="label" htmlFor={`oidc-${key}`} sx={labelSx}>
        {label}
      </Typography>
      <TextField
        id={`oidc-${key}`}
        fullWidth
        size="small"
        type={extra.type ?? 'text'}
        value={form[key]}
        placeholder={extra.placeholder}
        error={problem === key && form[key] !== ''}
        onChange={event => set(key, event.target.value)}
        slotProps={{ htmlInput: { maxLength: extra.maxLength, autoComplete: 'off' } }}
      />
      {hint ? <Typography sx={{ ...hintSx, mt: 0.5 }}>{hint}</Typography> : null}
    </Box>
  );

  return (
    <Paper component="form" onSubmit={submit} sx={{ mt: 3, p: 3 }}>
      <Typography component="h2" sx={{ fontSize: 15, fontWeight: 500 }}>
        {t.title}
      </Typography>
      <Typography sx={{ ...hintSx, fontSize: 14, mb: 2 }}>{t.hint}</Typography>
      <Stack spacing={2}>
        <Box
          sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}
        >
          <Typography sx={{ fontSize: 14 }}>{t.enabled}</Typography>
          <Switch
            checked={form.enabled}
            onChange={event => set('enabled', event.target.checked)}
            slotProps={{ input: { 'aria-label': t.enabled.value } }}
          />
        </Box>
        {field('issuer', t.issuer.value, undefined, {
          maxLength: LIMITS.issuer,
          placeholder: 'https://login.example.com',
        })}
        {field('clientId', t.clientId.value, undefined, { maxLength: LIMITS.clientId })}
        {field(
          'clientSecret',
          t.clientSecret.value,
          secretKept(form, status) ? t.secretKept.value : undefined,
          {
            type: 'password',
            maxLength: LIMITS.clientSecret,
          },
        )}
        {field('buttonLabel', t.buttonLabel.value, t.buttonLabelHint.value, {
          maxLength: LIMITS.buttonLabel,
        })}
        {field('extraScopes', t.extraScopes.value, t.extraScopesHint.value, {
          maxLength: LIMITS.extraScopes,
        })}
        {field(
          'allowedDomains',
          t.allowedDomains.value,
          problem === 'allowedDomains' ? t.domainsInvalid.value : t.allowedDomainsHint.value,
          { placeholder: 'example.com' },
        )}
        <Box
          sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}
        >
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontSize: 14 }}>{t.allowSignup}</Typography>
            <Typography sx={hintSx}>{t.allowSignupHint}</Typography>
          </Box>
          <Switch
            checked={form.allowSignup}
            onChange={event => set('allowSignup', event.target.checked)}
            slotProps={{ input: { 'aria-label': t.allowSignup.value } }}
          />
        </Box>
        <Box>
          <Typography sx={labelSx}>{t.redirectUri}</Typography>
          <Typography sx={{ fontSize: 14, overflowWrap: 'anywhere', fontFamily: 'monospace' }}>
            {status.redirectUri ?? t.redirectUriMissing}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          {status.configured ? (
            <Button
              type="button"
              variant="text"
              disabled={busy}
              onClick={clear}
              sx={{ textTransform: 'none' }}
            >
              {t.remove}
            </Button>
          ) : null}
          <Button
            type="submit"
            variant="contained"
            disabled={busy || problem !== null}
            sx={{ textTransform: 'none' }}
          >
            {t.save}
          </Button>
        </Box>
      </Stack>
    </Paper>
  );
}
