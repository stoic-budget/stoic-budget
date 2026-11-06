'use client';

import SmartToyIcon from '@mui/icons-material/SmartToy';
import Tooltip from '@mui/material/Tooltip';
import type React from 'react';
import { openAppPanel } from '@/app/components/panels/app-panels-store';
import { useWorkspace } from '@/app/contexts/WorkspaceContext';
import { useIntlayer } from '@/app/i18n';
import { readPluginSwitch } from '@/app/plugins/hooks/usePluginState';

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
      <button
        type="button"
        className="seneca-dashboard-header__assistant-btn"
        aria-label={label}
        onClick={() => openAppPanel('plugins', 'ai-assistant')}
      >
        <SmartToyIcon sx={{ fontSize: 18 }} />
      </button>
    </Tooltip>
  );
}
