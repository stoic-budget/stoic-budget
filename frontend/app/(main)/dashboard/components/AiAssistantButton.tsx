'use client';

import SmartToyIcon from '@mui/icons-material/SmartToy';
import Box from '@mui/material/Box';
import Tooltip from '@mui/material/Tooltip';
import type React from 'react';
import { openAppPanel } from '@/app/components/panels/app-panels-store';
import { useWorkspace } from '@/app/contexts/WorkspaceContext';
import { useIntlayer } from '@/app/i18n';
import { readPluginSwitch } from '@/app/plugins/hooks/usePluginState';
import { tokens } from '@/lib/theme-tokens';

/** Opens the AI assistant plugin; absent while the workspace has it switched off. */
export function AiAssistantButton(): React.JSX.Element | null {
  const { currentWorkspace } = useWorkspace();
  const t = useIntlayer('pluginsPage');

  if (!(currentWorkspace && readPluginSwitch(currentWorkspace.settings, 'ai-assistant'))) {
    return null;
  }

  const label = t.cards.aiAssistant.name.value;
  return (
    <Tooltip title={label}>
      <Box
        component="button"
        type="button"
        aria-label={label}
        onClick={() => openAppPanel('plugins', 'ai-assistant')}
        sx={{
          display: 'grid',
          placeItems: 'center',
          flexShrink: 0,
          width: 36,
          height: 36,
          border: 'none',
          borderRadius: tokens.radius.sm,
          bgcolor: 'transparent',
          color: 'var(--text-muted)',
          cursor: 'pointer',
          '&:hover': { color: 'var(--foreground)' },
          '&:focus-visible': { outline: '2px solid var(--primary)', outlineOffset: 1 },
        }}
      >
        <SmartToyIcon sx={{ fontSize: 22 }} />
      </Box>
    </Tooltip>
  );
}
