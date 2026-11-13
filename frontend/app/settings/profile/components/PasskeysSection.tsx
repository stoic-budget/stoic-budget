'use client';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { type FormEvent, useState } from 'react';
import { Alert } from '@/app/components/ui/alert';
import { SnapshotSkeleton } from '@/app/components/ui/snapshot-skeleton/SnapshotSkeleton';
import { Spinner } from '@/app/components/ui/spinner';
import { useIntlayer } from '@/app/i18n';
import { PASSKEY_NAME_MAX_LENGTH } from '@/app/lib/passkeys-api';
import type { UserFormatPreferences } from '@/app/lib/user-format';
import { isValidPasskeyName, PasskeyRow } from '@/app/settings/profile/components/PasskeyRow';
import type { Tx } from '@/app/settings/profile/components/TwoFactorPanels';
import type { UsePasskeysReturn } from '@/app/settings/profile/hooks/usePasskeys';
import { tokens } from '@/lib/theme-tokens';

type Props = {
  tx: Tx;
  passkeys: UsePasskeysReturn;
  formatPreferences: UserFormatPreferences;
};

/** Name and password, then the browser's own prompt creates the key. */
function AddPasskeyForm({ tx, passkeys }: Pick<Props, 'tx' | 'passkeys'>) {
  const t = useIntlayer('settingsPasskeysSection');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const added = await passkeys.add({ name, password });
    setPassword('');
    if (added) setName('');
  };

  return (
    <Box component="form" onSubmit={submit} sx={{ display: 'grid', gap: 1 }}>
      <TextField
        size="small"
        label={t.nameLabel.value}
        placeholder={t.namePlaceholder.value}
        value={name}
        onChange={event => setName(event.target.value)}
        slotProps={{ htmlInput: { maxLength: PASSKEY_NAME_MAX_LENGTH } }}
        required
        fullWidth
      />
      <TextField
        type="password"
        size="small"
        autoComplete="current-password"
        label={tx(['passwordCard', 'currentPasswordLabel'])}
        value={password}
        onChange={event => setPassword(event.target.value)}
        required
        fullWidth
      />
      <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button
          type="submit"
          variant="contained"
          disabled={passkeys.busy || !password || !isValidPasskeyName(name)}
          startIcon={passkeys.busy ? <Spinner size={16} /> : undefined}
        >
          {t.addButton}
        </Button>
      </Box>
    </Box>
  );
}

export function PasskeysSection({ tx, passkeys, formatPreferences }: Props) {
  const t = useIntlayer('settingsPasskeysSection');
  const { loading, loadFailed, supported, busy, message, error } = passkeys;

  return (
    <Stack spacing={2}>
      {message ? <Alert variant="success">{message}</Alert> : null}
      {error ? <Alert variant="error">{error}</Alert> : null}
      {loadFailed ? <Alert variant="error">{t.loadFailed}</Alert> : null}
      <Typography variant="body2" sx={{ color: 'var(--text-muted)' }}>
        {t.twoFactorNote}
      </Typography>

      <SnapshotSkeleton id="settings-passkeys" loading={loading} fallback="list">
        {passkeys.passkeys.length > 0 ? (
          <Stack spacing={1}>
            {passkeys.passkeys.map(passkey => (
              <PasskeyRow
                key={passkey.id}
                passkey={passkey}
                tx={tx}
                busy={busy}
                formatPreferences={formatPreferences}
                onRename={name => passkeys.rename({ id: passkey.id, name })}
                onRemove={password => passkeys.remove({ id: passkey.id, password })}
              />
            ))}
          </Stack>
        ) : (
          <Box
            sx={{
              borderRadius: tokens.radius.lg,
              border: '1px dashed',
              borderColor: 'divider',
              px: 2,
              py: 2,
              fontSize: 14,
              color: 'var(--text-muted)',
            }}
          >
            {t.empty}
          </Box>
        )}
      </SnapshotSkeleton>

      {supported ? (
        <AddPasskeyForm tx={tx} passkeys={passkeys} />
      ) : (
        <Alert variant="default">{t.unsupported}</Alert>
      )}
    </Stack>
  );
}
