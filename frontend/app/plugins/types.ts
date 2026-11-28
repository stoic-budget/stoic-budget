import type React from 'react';

export type PluginKey = 'ai-assistant' | 'webhooks' | 'mcp-server';

/** Integrations in the panel; each has a switch next to the plugin ones. */
export type IntegrationKey = 'smtp' | 'imap' | 'bank-sync' | 'peppol' | 'telegram';

/** Anything the panel can switch on and off. */
export type SwitchKey = PluginKey | IntegrationKey;

export interface PluginMeta {
  key: PluginKey;
  name: React.ReactNode;
  description: React.ReactNode;
  icon: React.ReactNode;
}
