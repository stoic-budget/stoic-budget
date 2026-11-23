'use client';
import { Box, Typography } from '@mui/material';
import { useIntlayer } from '@/app/i18n';
import { tokens } from '@/lib/theme-tokens';
import { useConnectedApps } from './useConnectedApps';

const sectionLabelStyle = {
  fontSize: 13,
  fontWeight: 600,
  color: 'var(--text-secondary)',
  mb: 1.5,
};

/**
 * The drawer's status line: connected while there is an API key or an app
 * connected over OAuth, with both counts. The apps are the ones the drawer
 * lists: the person's own, or every member's for whoever manages MCP access.
 */
export function McpStatus({ keyCount }: { keyCount: number }) {
  const t = useIntlayer('mcpServerDrawer');
  const { apps } = useConnectedApps();
  const active = keyCount > 0 || apps.length > 0;

  return (
    <Box>
      <Typography sx={sectionLabelStyle}>{t.status}</Typography>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          p: 1.5,
          borderRadius: tokens.radius.md,
          background: active ? 'var(--primary-50)' : 'var(--surface-soft)',
          border: '1px solid var(--border)',
        }}
      >
        <Box
          aria-hidden
          sx={{
            width: 8,
            height: 8,
            borderRadius: tokens.radius.full,
            bgcolor: active ? 'var(--primary)' : 'var(--text-muted)',
            flexShrink: 0,
          }}
        />
        <Typography
          sx={{
            fontSize: 13,
            fontWeight: 500,
            color: active ? 'var(--primary)' : 'var(--text-muted)',
          }}
        >
          {active
            ? t.connectedSummary.value
                .replace('{keys}', String(keyCount))
                .replace('{apps}', String(apps.length))
            : t.notConfigured}
        </Typography>
      </Box>
    </Box>
  );
}
