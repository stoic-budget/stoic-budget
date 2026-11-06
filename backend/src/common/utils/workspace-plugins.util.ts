/**
 * Which plugins a workspace has switched on. Stored under `settings.plugins`
 * next to `processing` and `profile`; a missing key takes its default.
 */

export const pluginKeys = ['webhooks', 'mcp', 'aiAssistant'] as const;
export type WorkspacePluginKey = (typeof pluginKeys)[number];

export type WorkspacePluginSettings = Record<WorkspacePluginKey, boolean>;

export const DEFAULT_PLUGIN_SETTINGS: WorkspacePluginSettings = {
  webhooks: false,
  mcp: false,
  aiAssistant: true,
};

const PLUGINS_KEY = 'plugins';

/** Reads the switches off a workspace; anything but a boolean takes the default. */
export const readPluginSettings = (
  workspace?: { settings?: Record<string, unknown> | null } | null,
): WorkspacePluginSettings => {
  const raw = workspace?.settings?.[PLUGINS_KEY];
  const stored = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return Object.fromEntries(
    pluginKeys.map(key => [
      key,
      typeof stored[key] === 'boolean' ? stored[key] : DEFAULT_PLUGIN_SETTINGS[key],
    ]),
  ) as WorkspacePluginSettings;
};

/** Merges a patch into the workspace settings blob without touching other keys. */
export const mergePluginSettings = (
  current: Record<string, unknown> | null | undefined,
  patch: Partial<WorkspacePluginSettings>,
): Record<string, unknown> => ({
  ...(current ?? {}),
  [PLUGINS_KEY]: readPluginSettings({
    settings: { [PLUGINS_KEY]: { ...readPluginSettings({ settings: current }), ...patch } },
  }),
});
