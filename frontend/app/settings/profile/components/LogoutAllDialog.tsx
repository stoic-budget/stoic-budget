'use client';

import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useState } from 'react';
import { PasskeyReviewList } from '@/app/components/passkeys/PasskeyReviewList';
import { Alert } from '@/app/components/ui/alert';
import { ModalFooter, ModalShell } from '@/app/components/ui/modal-shell';
import { useIntlayer } from '@/app/i18n';
import type { Passkey } from '@/app/lib/contracts';
import { getApiErrorMessage } from '@/app/settings/profile/profileHelpers';

type Props = {
  passkeys: readonly Passkey[];
  tx: (path: string[]) => string;
  onClose: () => void;
  /** Logs out everywhere and keeps every passkey, as before. */
  onLogoutAll: () => Promise<void>;
  /** Removes these passkeys after the password check, then logs out everywhere. */
  onLogoutAllRemoving: (removePasskeyIds: string[], password: string) => Promise<void>;
};

/**
 * The "log out everywhere" confirmation for an account with passkeys: a passkey
 * outlives the logout, so the step lists them and can remove them too. Nothing
 * chosen logs out exactly as the plain confirmation does.
 */
export function LogoutAllDialog({
  passkeys,
  tx,
  onClose,
  onLogoutAll,
  onLogoutAllRemoving,
}: Props) {
  const t = useIntlayer('passkeyReviewList');
  const [remove, setRemove] = useState(false);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirm = async () => {
    setBusy(true);
    setError(null);
    if (!remove) {
      await onLogoutAll();
      return;
    }
    await onLogoutAllRemoving(
      passkeys.map(passkey => passkey.id),
      password,
    ).catch((err: unknown) => {
      setError(getApiErrorMessage(err, tx(['sessionsCard', 'sessionLogoutError'])));
      setBusy(false);
    });
  };

  return (
    <ModalShell
      isOpen
      onClose={busy ? () => undefined : onClose}
      title={tx(['sessionsCard', 'logoutAllButton'])}
      size="sm"
      footer={
        <ModalFooter
          onCancel={onClose}
          cancelText={tx(['securityCard', 'cancelButton'])}
          onConfirm={confirm}
          confirmText={tx(['sessionsCard', 'logoutAllButton'])}
          confirmVariant="destructive"
          isConfirmLoading={busy}
          isConfirmDisabled={remove && !password}
        />
      }
    >
      <Stack spacing={2}>
        <Typography variant="body2" sx={{ color: 'text.primary' }}>
          {tx(['sessionsCard', 'logoutAllConfirm'])}
        </Typography>
        <PasskeyReviewList
          passkeys={passkeys}
          remove={remove}
          onRemoveChange={setRemove}
          disabled={busy}
        />
        {remove ? (
          <Stack spacing={1}>
            <Typography variant="body2" sx={{ color: 'var(--text-muted)' }}>
              {t.passwordHint}
            </Typography>
            <TextField
              id="logout-all-password"
              type="password"
              size="small"
              autoComplete="current-password"
              label={tx(['passwordCard', 'currentPasswordLabel'])}
              value={password}
              onChange={event => setPassword(event.target.value)}
              disabled={busy}
              required
              fullWidth
            />
          </Stack>
        ) : null}
        {error ? <Alert variant="error">{error}</Alert> : null}
      </Stack>
    </ModalShell>
  );
}
