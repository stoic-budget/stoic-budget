'use client';

import { useCallback, useState } from 'react';
import toast from 'react-hot-toast';
import { useWorkspace } from '@/app/contexts/WorkspaceContext';
import { useIntlayer } from '@/app/i18n';
import type { SwitchKey } from '../types';

/** Where each switch lives in `workspace.settings.plugins`. */
const SETTINGS_KEY = {
  'ai-assistant': 'aiAssistant',
  webhooks: 'webhooks',
  'mcp-server': 'mcp',
  smtp: 'smtp',
  imap: 'imap',
  'bank-sync': 'bankSync',
  peppol: 'peppol',
  telegram: 'telegram',
} as const satisfies Record<SwitchKey, string>;

/** As on the server: integrations start on, the opt-in plugins off. */
const DEFAULT_ENABLED: Record<SwitchKey, boolean> = {
  'ai-assistant': true,
  webhooks: false,
  'mcp-server': false,
  smtp: true,
  imap: true,
  'bank-sync': true,
  peppol: true,
  telegram: true,
};

/** A missing or non-boolean switch takes its default, as on the server. */
export function readPluginSwitch(
  settings: Record<string, unknown> | null | undefined,
  key: SwitchKey,
): boolean {
  const plugins = settings?.plugins;
  const stored =
    typeof plugins === 'object' && plugins !== null
      ? (plugins as Record<string, unknown>)[SETTINGS_KEY[key]]
      : undefined;
  return typeof stored === 'boolean' ? stored : DEFAULT_ENABLED[key];
}

/** Plugin and integration switches of the open workspace; only owners and admins may flip them. */
export function usePluginState() {
  const { currentWorkspace, setWorkspacePlugins } = useWorkspace();
  const t = useIntlayer('pluginsPage');
  const [pending, setPending] = useState<SwitchKey | null>(null);
  const settings = currentWorkspace?.settings;
  const workspaceId = currentWorkspace?.id;
  const canToggle =
    currentWorkspace?.memberRole === 'owner' || currentWorkspace?.memberRole === 'admin';

  const isEnabled = useCallback((key: SwitchKey) => readPluginSwitch(settings, key), [settings]);

  const setEnabled = useCallback(
    async (key: SwitchKey, enabled: boolean): Promise<void> => {
      if (!workspaceId) {
        return;
      }
      setPending(key);
      try {
        await setWorkspacePlugins({ workspaceId, plugins: { [SETTINGS_KEY[key]]: enabled } });
      } catch {
        toast.error(t.toggleFailed.value);
      } finally {
        setPending(null);
      }
    },
    [workspaceId, setWorkspacePlugins, t.toggleFailed],
  );

  return { isEnabled, setEnabled, canToggle, pending };
}
