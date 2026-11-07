'use client';

import SmartToyIcon from '@mui/icons-material/SmartToy';
import WebhookIcon from '@mui/icons-material/Webhook';
import type React from 'react';
import { Cpu } from '@/app/components/icons';
import { useIntlayer } from '@/app/i18n';
import type { PluginKey } from '../types';

export type PluginItem = {
  key: PluginKey;
  name: string;
  description: React.ReactNode;
  icon: React.ReactNode;
  /** Whether the plugin has settings of its own in the second layer. */
  configurable: boolean;
};

/** Every plugin, in the order the panel and the dashboard show them. */
export function usePlugins(): PluginItem[] {
  const t = useIntlayer('pluginsPage');
  const webhooksText = useIntlayer('webhooksDrawer');
  const mcpText = useIntlayer('mcpServerDrawer');

  return [
    {
      key: 'ai-assistant',
      name: t.cards.aiAssistant.name.value,
      description: t.cards.aiAssistant.description,
      icon: <SmartToyIcon sx={{ fontSize: 22 }} />,
      configurable: true,
    },
    {
      key: 'webhooks',
      name: webhooksText.title.value,
      description: t.cards.webhooks.description,
      icon: <WebhookIcon sx={{ fontSize: 22 }} />,
      configurable: true,
    },
    {
      key: 'mcp-server',
      name: mcpText.title.value,
      description: t.cards.mcpServer.description,
      icon: <Cpu size={22} />,
      configurable: true,
    },
  ];
}
