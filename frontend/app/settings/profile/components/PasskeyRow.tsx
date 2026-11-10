'use client';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { type FormEvent, useState } from 'react';
import { useIntlayer } from '@/app/i18n';
import type { Passkey } from '@/app/lib/contracts';
import { PASSKEY_NAME_MAX_LENGTH } from '@/app/lib/passkeys-api';
import { formatDateTime, type UserFormatPreferences } from '@/app/lib/user-format';
import { PasswordPrompt, type Tx } from '@/app/settings/profile/components/TwoFactorPanels';
import { tokens } from '@/lib/theme-tokens';

type Props = {
  passkey: Passkey;
  tx: Tx;
  busy: boolean;
  formatPreferences: UserFormatPreferences;
  onRename: (name: string) => Promise<boolean>;
  onRemove: (password: string) => Promise<boolean>;
};

/** A name the server will take: not blank, at most 60 characters (the contract's `PasskeyName`). */
export const isValidPasskeyName = (name: string): boolean =>
  name.trim().length > 0 && name.length <= PASSKEY_NAME_MAX_LENGTH;

/** One passkey: its name and dates, renamed in place, removed after the password. */
export function PasskeyRow({ passkey, tx, busy, formatPreferences, onRename, onRemove }: Props) {
  const t = useIntlayer('settingsPasskeysSection');
  const [mode, setMode] = useState<'view' | 'rename' | 'remove'>('view');
  const [name, setName] = useState(passkey.name);

  const startRename = () => {
    setName(passkey.name);
    setMode('rename');
  };

  const submitRename = async (event: FormEvent) => {
    event.preventDefault();
    if (await onRename(name)) setMode('view');
  };

  const lastUsed = passkey.lastUsedAt
    ? formatDateTime(passkey.lastUsedAt, formatPreferences)
    : t.neverUsed.value;

  return (
    <Box
      sx={{
        display: 'grid',
        gap: 1.5,
        borderRadius: tokens.radius.lg,
        border: '1px solid',
        borderColor: 'divider',
        bgcolor: 'background.paper',
        px: 2,
        py: 1.5,
      }}
    >
      {mode === 'rename' ? (
        <Box component="form" onSubmit={submitRename} sx={{ display: 'grid', gap: 1 }}>
          <TextField
            size="small"
            label={t.nameLabel.value}
            value={name}
            onChange={event => setName(event.target.value)}
            slotProps={{ htmlInput: { maxLength: PASSKEY_NAME_MAX_LENGTH } }}
            autoFocus
            required
            fullWidth
          />
          <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end' }}>
            <Button onClick={() => setMode('view')} disabled={busy}>
              {tx(['securityCard', 'cancelButton'])}
            </Button>
            <Button type="submit" variant="contained" disabled={busy || !isValidPasskeyName(name)}>
              {t.save}
            </Button>
          </Stack>
        </Box>
      ) : (
        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            gap: 1,
            justifyContent: 'space-between',
            alignItems: { sm: 'center' },
          }}
        >
          <Stack spacing={0.25} sx={{ minWidth: 0 }}>
            <Typography
              variant="body2"
              sx={{ fontWeight: 500, color: 'text.primary', overflowWrap: 'anywhere' }}
            >
              {passkey.name}
            </Typography>
            <Typography variant="caption" sx={{ color: 'var(--text-muted)' }}>
              {passkey.deviceType === 'multiDevice' ? t.synced : t.deviceOnly}
              {' · '}
              {t.addedLabel}: {formatDateTime(passkey.createdAt, formatPreferences)}
              {' · '}
              {t.lastUsedLabel}: {lastUsed}
            </Typography>
          </Stack>
          {mode === 'view' ? (
            <Stack direction="row" spacing={1} sx={{ flexShrink: 0 }}>
              <Button size="small" onClick={startRename} disabled={busy}>
                {t.rename}
              </Button>
              <Button size="small" onClick={() => setMode('remove')} disabled={busy}>
                {t.remove}
              </Button>
            </Stack>
          ) : null}
        </Box>
      )}

      {mode === 'remove' ? (
        <PasswordPrompt
          tx={tx}
          busy={busy}
          submitLabel={t.remove.value}
          onCancel={() => setMode('view')}
          onSubmit={async password => {
            if (await onRemove(password)) setMode('view');
          }}
        />
      ) : null}
    </Box>
  );
}
