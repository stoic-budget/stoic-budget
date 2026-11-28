import { Raw } from 'typeorm';
import { STANDARD_WORKSPACE } from '../workspaces/version-workspaces';

/**
 * Which plugins and integrations a workspace has switched on. Stored under
 * `settings.plugins` next to `processing` and `profile`; a missing key takes
 * its default. Integrations default to on: they did nothing before they were
 * set up, and a workspace that set one up keeps it running.
 */

export const pluginKeys = [
  'webhooks',
  'mcp',
  'aiAssistant',
  'smtp',
  'imap',
  'bankSync',
  'peppol',
  'telegram',
] as const;
export type WorkspacePluginKey = (typeof pluginKeys)[number];

export type WorkspacePluginSettings = Record<WorkspacePluginKey, boolean>;

export const DEFAULT_PLUGIN_SETTINGS: WorkspacePluginSettings = {
  webhooks: false,
  mcp: false,
  aiAssistant: true,
  smtp: true,
  imap: true,
  bankSync: true,
  peppol: true,
  telegram: true,
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

/**
 * SQL that holds while `settingsColumn` (a `workspaces.settings` jsonb) leaves
 * `plugin` on, with the same default as `readPluginSettings`.
 */
export const pluginOnSql = (settingsColumn: string, plugin: WorkspacePluginKey): string =>
  DEFAULT_PLUGIN_SETTINGS[plugin]
    ? `(${settingsColumn} -> '${PLUGINS_KEY}' -> '${plugin}') IS DISTINCT FROM 'false'::jsonb`
    : `(${settingsColumn} -> '${PLUGINS_KEY}' -> '${plugin}') = 'true'::jsonb`;

/** For `find()` on a `workspace` relation: a live workspace (not a version) with `plugin` on. */
export const standardWorkspaceWith = (plugin: WorkspacePluginKey) => ({
  ...STANDARD_WORKSPACE,
  settings: Raw(alias => pluginOnSql(alias, plugin)),
});
