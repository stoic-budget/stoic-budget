'use client';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useSearchParams } from 'next/navigation';
import type React from 'react';
import { useMemo, useState } from 'react';
import { Link2 } from '@/app/components/icons';
import { Alert } from '@/app/components/ui/alert';
import { useIntlayer } from '@/app/i18n';
import type { OidcIdentity } from '@/app/lib/contracts';
import { oidcErrorMessage } from '@/app/lib/oidc-error';
import { formatDateTime, type UserFormatPreferences } from '@/app/lib/user-format';
import { PasswordPrompt, type Tx } from '@/app/settings/profile/components/TwoFactorPanels';
import type { SettingsSectionId } from '@/app/settings/profile/helpers/settings-url-state';
import { useOidcIdentities } from '@/app/settings/profile/hooks/useOidcIdentities';
import { SettingsAccordion } from './SettingsAccordion';

const hostOf = (issuer: string): string => {
  try {
    return new URL(issuer).host;
  } catch {
    return issuer;
  }
};

/**
 * Provider accounts that sign this user in. Hidden while the server has no
 * provider and nothing is linked. The last way in of an account without a
 * password cannot be unlinked; the server refuses it too. Linking asks for
 * the current password, so an account without one cannot link more.
 */
export function SingleSignOnSection({
  openSection,
  formatPreferences,
  tx,
}: {
  openSection: SettingsSectionId;
  formatPreferences: UserFormatPreferences;
  /** The settings text, for the password prompt shared with two-factor. */
  tx: Tx;
}): React.JSX.Element | null {
  const t = useIntlayer('singleSignOnSection');
  const params = useSearchParams();
  const messages = useMemo(
    () => ({ loadError: t.loadError.value, actionError: t.actionError.value }),
    [t.loadError.value, t.actionError.value],
  );
  const { list, error, busyId, unlinked, link, unlink } = useOidcIdentities(messages);
  const [asking, setAsking] = useState(false);
  const returned = params.get('oidc') === 'linked';
  const returnedError = oidcErrorMessage(params.get('oidcError'), t.actionError.value);

  const identities = list?.identities ?? [];
  if (!(list?.providerEnabled || identities.length > 0 || returned || returnedError || error)) {
    return null;
  }
  const lastWayIn = list ? !list.passwordSet && identities.length <= 1 : false;
  const remove = (identity: OidcIdentity) => {
    if (window.confirm(t.unlinkConfirm.value)) void unlink(identity);
  };

  return (
    <SettingsAccordion
      id="single-sign-on"
      title={t.title.value}
      description={t.description.value}
      icon={Link2}
      defaultExpanded={openSection === 'single-sign-on' || returned || Boolean(returnedError)}
    >
      <Stack spacing={2}>
        {returned && !unlinked ? <Alert variant="success">{t.linkedMessage}</Alert> : null}
        {unlinked ? <Alert variant="success">{t.unlinkedMessage}</Alert> : null}
        {returnedError || error ? <Alert variant="error">{error ?? returnedError}</Alert> : null}
        {identities.length === 0 ? (
          <Typography sx={{ fontSize: 14, color: 'var(--text-muted)' }}>{t.empty}</Typography>
        ) : (
          identities.map(identity => (
            <Box
              key={identity.id}
              sx={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 1.5,
                py: 1.5,
                borderBottom: '1px solid var(--border)',
              }}
            >
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ fontSize: 15, fontWeight: 500, overflowWrap: 'anywhere' }}>
                  {identity.email ?? hostOf(identity.issuer)}
                </Typography>
                <Typography
                  sx={{ fontSize: 13, color: 'var(--text-muted)', overflowWrap: 'anywhere' }}
                >
                  {hostOf(identity.issuer)} · {t.linkedLabel}{' '}
                  {formatDateTime(identity.createdAt, formatPreferences)} ·{' '}
                  {identity.lastUsedAt ? (
                    <>
                      {t.lastUsedLabel} {formatDateTime(identity.lastUsedAt, formatPreferences)}
                    </>
                  ) : (
                    t.neverUsed
                  )}
                </Typography>
              </Box>
              <Button
                variant="text"
                size="small"
                disabled={lastWayIn || busyId !== null}
                onClick={() => remove(identity)}
                sx={{ color: 'var(--text-muted)', textTransform: 'none' }}
              >
                {t.unlink}
              </Button>
            </Box>
          ))
        )}
        {lastWayIn && identities.length > 0 ? (
          <Typography sx={{ fontSize: 13, color: 'var(--text-muted)' }}>
            {t.lastMethodHint}
          </Typography>
        ) : null}
        {list?.providerEnabled && !list.passwordSet ? (
          <Typography sx={{ fontSize: 13, color: 'var(--text-muted)' }}>
            {t.linkNeedsPassword}
          </Typography>
        ) : null}
        {list?.providerEnabled && list.passwordSet && asking ? (
          <PasswordPrompt
            tx={tx}
            busy={busyId === 'link'}
            submitLabel={t.link.value}
            onCancel={() => setAsking(false)}
            onSubmit={password => void link(password)}
          />
        ) : null}
        {list?.providerEnabled && list.passwordSet && !asking ? (
          <Box>
            <Button
              variant="outlined"
              disabled={busyId !== null}
              onClick={() => setAsking(true)}
              sx={{ textTransform: 'none', borderRadius: '8px' }}
            >
              {t.link}
            </Button>
          </Box>
        ) : null}
      </Stack>
    </SettingsAccordion>
  );
}
