'use client';

import { Box, Button, Typography } from '@mui/material';
import { useState } from 'react';
import { ChoiceCards } from '@/app/components/ui/choice-cards';
import { Select } from '@/app/components/ui/select';
import { useIntlayer } from '@/app/i18n';
import { APP_NAME } from '@/app/lib/brand';
import type { McpOAuthConsent } from '@/app/lib/contracts';
import { tokens } from '@/lib/theme-tokens';
import { ScopeChecklist } from './ScopeChecklist';
import type { ConsentDecision } from './useOAuthConsent';

type Consent = Extract<McpOAuthConsent, { kind: 'consent' }>;
type Scope = ConsentDecision['scopes'][number];
type Mode = 'read' | 'write' | 'custom';

const labelStyle = { fontSize: 13, fontWeight: 500, color: 'var(--text-muted)', mb: 1 };

/** What the form sends is what it shows: the custom list is cut to the picked workspace. */
export function chosenScopes(
  workspace: Consent['workspaces'][number] | undefined,
  mode: Mode,
  custom: readonly Scope[],
): Scope[] {
  if (!workspace) return [];
  return mode === 'custom'
    ? workspace.write.filter(scope => custom.includes(scope))
    : workspace[mode];
}

export function ConsentForm({
  consent,
  deciding,
  error,
  onDecide,
}: {
  consent: Consent;
  deciding: boolean;
  error: string | null;
  onDecide: (decision: ConsentDecision) => void;
}) {
  const t = useIntlayer('oauthConsentPage');
  const usable = consent.workspaces.filter(workspace => workspace.mcpEnabled);
  const [workspaceId, setWorkspaceId] = useState(usable[0]?.id ?? '');
  // An app that asked for particular scopes gets those offered, and no more.
  const [mode, setMode] = useState<Mode>(consent.requestedScopes.length > 0 ? 'custom' : 'read');
  const [custom, setCustom] = useState<Scope[]>(consent.requestedScopes);
  const workspace = usable.find(item => item.id === workspaceId);
  const scopes = chosenScopes(workspace, mode, custom);
  const anyWorkspaceId = workspace?.id ?? consent.workspaces[0]?.id ?? '';

  return (
    <Box component="form" onSubmit={event => event.preventDefault()}>
      <Typography
        component="h1"
        sx={{ fontSize: 18, fontWeight: 500, mb: 1, overflowWrap: 'anywhere' }}
      >
        {/* A function, so `$&` and friends in a registrant's name stay literal. */}
        {t.title.value.replace('{app}', () => consent.clientName)}
      </Typography>
      <Typography sx={{ fontSize: 14, color: 'var(--text-muted)', mb: 2 }}>
        {t.intro.value.replace('{product}', APP_NAME)}
      </Typography>
      <Box sx={{ p: 1.5, mb: 2.5, borderRadius: tokens.radius.sm, bgcolor: 'var(--surface-soft)' }}>
        <Typography component="span" sx={{ fontSize: 13, color: 'var(--text-muted)' }}>
          {t.returnTo}{' '}
        </Typography>
        <Typography
          component="span"
          sx={{ fontSize: 13, fontWeight: 500, fontFamily: 'monospace', overflowWrap: 'anywhere' }}
        >
          {consent.redirectHost}
        </Typography>
      </Box>

      <Typography id="oauth-workspace" sx={labelStyle}>
        {t.workspace}
      </Typography>
      {usable.length === 0 ? (
        <Typography role="status" sx={{ fontSize: 14, color: 'var(--text-muted)', mb: 2.5 }}>
          {t.noWorkspace}
        </Typography>
      ) : (
        <Select
          size="small"
          fullWidth
          value={workspaceId}
          inputProps={{ 'aria-labelledby': 'oauth-workspace' }}
          onChange={setWorkspaceId}
          options={consent.workspaces.map(item => ({
            value: item.id,
            label: item.mcpEnabled ? item.name : `${item.name} · ${t.mcpOff.value}`,
            disabled: !item.mcpEnabled,
          }))}
          sx={{ mb: 2.5 }}
        />
      )}

      {workspace ? (
        <>
          <Typography id="oauth-access" sx={labelStyle}>
            {t.access}
          </Typography>
          <ChoiceCards<Mode>
            aria-labelledby="oauth-access"
            columns={3}
            value={mode}
            onChange={setMode}
            options={[
              { value: 'read', title: t.read, description: t.readHint },
              { value: 'write', title: t.write, description: t.writeHint },
              { value: 'custom', title: t.custom, description: t.customHint },
            ]}
          />
          {mode === 'custom' ? (
            <ScopeChecklist available={workspace.write} checked={custom} onChange={setCustom} />
          ) : null}
        </>
      ) : null}

      <Typography sx={{ fontSize: 13, color: 'var(--text-muted)', mt: 2.5 }}>
        {t.revokeHint}
      </Typography>
      {error ? (
        <Typography role="alert" sx={{ fontSize: 13, color: 'var(--money-down)', mt: 1.5 }}>
          {error}
        </Typography>
      ) : null}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 3 }}>
        <Button
          type="button"
          variant="text"
          disabled={deciding || !anyWorkspaceId}
          onClick={() => onDecide({ approve: false, workspaceId: anyWorkspaceId, scopes: [] })}
          sx={{ color: 'var(--text-muted)' }}
        >
          {t.deny}
        </Button>
        <Button
          type="submit"
          variant="contained"
          disabled={deciding || !workspace || scopes.length === 0}
          onClick={() => {
            if (workspace) onDecide({ approve: true, workspaceId: workspace.id, scopes });
          }}
        >
          {deciding ? t.returning : t.allow}
        </Button>
      </Box>
    </Box>
  );
}
