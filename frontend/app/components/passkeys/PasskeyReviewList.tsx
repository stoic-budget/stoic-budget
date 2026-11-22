'use client';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { Checkbox } from '@/app/components/ui/checkbox';
import { useIntlayer } from '@/app/i18n';
import type { Passkey } from '@/app/lib/contracts';
import { formatDateTime } from '@/app/lib/user-format';
import { useUserFormat } from '@/app/lib/user-format-store';
import { tokens } from '@/lib/theme-tokens';

type Props = {
  passkeys: readonly Passkey[];
  remove: boolean;
  onRemoveChange: (remove: boolean) => void;
  disabled?: boolean;
};

/**
 * The account's passkeys at a cleanup (a password reset, "log out everywhere"):
 * each one's name and dates, and one choice to remove them all with it. The
 * list shows whether or not the box is ticked, so nothing is removed unseen.
 */
export function PasskeyReviewList({ passkeys, remove, onRemoveChange, disabled }: Props) {
  const t = useIntlayer('passkeyReviewList');
  const row = useIntlayer('settingsPasskeysSection');
  const { preferences } = useUserFormat();
  if (passkeys.length === 0) return null;

  return (
    <Stack spacing={1} sx={{ width: '100%', textAlign: 'start' }} data-testid="passkey-review">
      <Typography variant="body2" sx={{ fontWeight: 500, color: 'text.primary' }}>
        {t.heading}
      </Typography>
      <Typography variant="body2" sx={{ color: 'var(--text-muted)' }}>
        {t.hint}
      </Typography>
      <Box
        component="ul"
        sx={{
          listStyle: 'none',
          m: 0,
          p: 0,
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: tokens.radius.lg,
          '& > li + li': { borderTop: '1px solid', borderColor: 'divider' },
        }}
      >
        {passkeys.map(passkey => (
          <Box component="li" key={passkey.id} sx={{ px: 1.5, py: 1 }}>
            <Typography
              variant="body2"
              sx={{ fontWeight: 500, color: 'text.primary', overflowWrap: 'anywhere' }}
            >
              {passkey.name}
            </Typography>
            <Typography variant="caption" sx={{ color: 'var(--text-muted)' }}>
              {passkey.deviceType === 'multiDevice' ? row.synced : row.deviceOnly}
              {' · '}
              {row.addedLabel}: {formatDateTime(passkey.createdAt, preferences)}
              {' · '}
              {row.lastUsedLabel}:{' '}
              {passkey.lastUsedAt
                ? formatDateTime(passkey.lastUsedAt, preferences)
                : row.neverUsed.value}
            </Typography>
          </Box>
        ))}
      </Box>
      <Checkbox
        id="remove-passkeys"
        checked={remove}
        disabled={disabled}
        onCheckedChange={onRemoveChange}
        label={t.removeLabel.value}
      />
    </Stack>
  );
}
