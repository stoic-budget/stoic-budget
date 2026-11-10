'use client';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from '@mui/material';
import { useState } from 'react';
import { Link2, Trash2 } from '@/app/components/icons';
import { useIntlayer } from '@/app/i18n';
import { formatStoredDate } from '@/app/lib/user-format-store';
import { tokens } from '@/lib/theme-tokens';
import { timeAgo } from './time-ago';
import { useConnectedApps } from './useConnectedApps';

const sectionLabelStyle = { fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', mb: 1 };
const hintStyle = { fontSize: 12, color: 'var(--text-secondary)', mb: 1.5 };

/**
 * "Connected apps": MCP clients approved over OAuth in this workspace. Anyone
 * can connect one, so everyone sees their own here; whoever manages MCP access
 * sees every member's, each with who connected it.
 */
export function McpConnectedApps() {
  const t = useIntlayer('mcpServerDrawer');
  const { apps, workspaceWide, loading, disconnect, disconnecting } = useConnectedApps();
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const confirming = apps.find(app => app.id === confirmId) ?? null;

  return (
    <Box>
      <Typography sx={sectionLabelStyle}>
        {workspaceWide ? t.workspaceConnectedApps : t.connectedApps}
      </Typography>
      <Typography sx={hintStyle}>
        {workspaceWide ? t.workspaceConnectedAppsHint : t.connectedAppsHint}
      </Typography>
      {loading ? (
        <Typography sx={{ fontSize: 13, color: 'var(--text-secondary)' }}>{t.loading}</Typography>
      ) : apps.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 2, color: 'var(--text-secondary)' }}>
          <Link2 size={22} style={{ opacity: 0.4, marginBottom: 4 }} aria-hidden />
          <Typography sx={{ fontSize: 13 }}>{t.noConnectedApps}</Typography>
        </Box>
      ) : (
        <Box component="ul" sx={{ display: 'flex', flexDirection: 'column', gap: 1, m: 0, p: 0 }}>
          {apps.map(app => (
            <Box
              component="li"
              key={app.id}
              sx={{
                listStyle: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 1,
                p: 1.5,
                borderRadius: tokens.radius.md,
                border: '1px solid var(--border-color)',
              }}
            >
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ fontSize: 13, fontWeight: 500, overflowWrap: 'anywhere' }}>
                  {app.clientName}
                </Typography>
                <Typography
                  sx={{ fontSize: 12, color: 'var(--text-secondary)', overflowWrap: 'anywhere' }}
                >
                  {app.memberName ? `${app.memberName} · ` : ''}
                  {app.redirectHosts.join(', ')} ·{' '}
                  {t.connectedOn.value.replace('{date}', formatStoredDate(app.createdAt))} ·{' '}
                  {timeAgo(app.lastUsedAt, t)} ·{' '}
                  {t.scopeCount.value.replace('{count}', String(app.scopes.length))}
                </Typography>
              </Box>
              <button
                type="button"
                onClick={() => setConfirmId(app.id)}
                aria-label={`${t.disconnect.value}: ${app.clientName}${app.memberName ? ` · ${app.memberName}` : ''}`}
                title={t.disconnect.value}
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 4,
                  color: 'var(--text-secondary)',
                  display: 'flex',
                  flexShrink: 0,
                }}
              >
                <Trash2 size={15} />
              </button>
            </Box>
          ))}
        </Box>
      )}

      {/* Above the drawer, which the plugins panel opens at the popover layer. */}
      <Dialog
        open={Boolean(confirming)}
        onClose={() => setConfirmId(null)}
        maxWidth="xs"
        fullWidth
        sx={{ zIndex: tokens.zIndex.popover + 1 }}
      >
        <DialogTitle sx={{ fontSize: 15, fontWeight: 500 }}>{t.disconnectTitle}</DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            {confirming?.memberName ? `${confirming.memberName} · ` : ''}
            {confirming?.clientName} ·{' '}
            {workspaceWide ? t.disconnectHintWorkspace : t.disconnectHint}
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setConfirmId(null)} sx={{ color: 'var(--text-secondary)' }}>
            {t.cancel}
          </Button>
          <Button
            variant="contained"
            disabled={disconnecting}
            onClick={() => {
              if (confirmId) disconnect(confirmId);
              setConfirmId(null);
            }}
          >
            {t.disconnect}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
