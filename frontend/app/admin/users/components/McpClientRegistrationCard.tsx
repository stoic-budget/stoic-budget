'use client';

import { Box, Paper, Skeleton, Switch, Typography } from '@mui/material';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { useIntlayer } from '@/app/i18n';
import { getApiErrorMessage } from '@/app/lib/api-error';
import { useMcpClientRegistration } from '../hooks/useMcpClientRegistration';

/** Whether MCP apps can register themselves to ask people for access over OAuth. */
export function McpClientRegistrationCard() {
  const t = useIntlayer('adminUsersPage').mcpRegistration;
  const { open, save } = useMcpClientRegistration();
  const [saving, setSaving] = useState(false);

  const change = async (next: boolean): Promise<void> => {
    setSaving(true);
    await save(next)
      .catch(async (error: unknown) => {
        toast.error(getApiErrorMessage(error, t.saveFailed.value));
      })
      .finally(async () => {
        setSaving(false);
      });
  };

  return (
    <Paper
      sx={{
        mt: 3,
        p: 3,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 2,
      }}
    >
      <Box sx={{ minWidth: 0 }}>
        <Typography component="h2" sx={{ fontSize: 15, fontWeight: 500 }}>
          {t.title}
        </Typography>
        <Typography sx={{ fontSize: 14, color: 'var(--text-muted)' }}>
          {open === null ? <Skeleton width={320} /> : open ? t.openHint : t.closedHint}
        </Typography>
      </Box>
      <Switch
        checked={open ?? false}
        disabled={open === null || saving}
        onChange={event => void change(event.target.checked)}
        slotProps={{ input: { 'aria-label': t.title.value } }}
      />
    </Paper>
  );
}
