import {
  DEFAULT_PLUGIN_SETTINGS,
  mergePluginSettings,
  pluginOnSql,
  readPluginSettings,
} from '@/common/utils/workspace-plugins.util';

/** Integrations start on: a workspace that set one up keeps it running. */
const INTEGRATIONS_ON = { smtp: true, imap: true, bankSync: true, peppol: true, telegram: true };

describe('readPluginSettings', () => {
  it('treats a workspace without switches as having the AI assistant and the integrations on', () => {
    expect(readPluginSettings(null)).toEqual(DEFAULT_PLUGIN_SETTINGS);
    expect(readPluginSettings({ settings: null })).toEqual({
      webhooks: false,
      mcp: false,
      aiAssistant: true,
      ...INTEGRATIONS_ON,
    });
    expect(readPluginSettings({ settings: { plugins: 'on' } })).toEqual(DEFAULT_PLUGIN_SETTINGS);
  });

  it('reads stored switches and ignores anything that is not a boolean', () => {
    const settings = {
      plugins: { webhooks: true, mcp: 'yes', aiAssistant: 1, imap: false, peppol: 'off', other: true },
    };

    expect(readPluginSettings({ settings })).toEqual({
      ...INTEGRATIONS_ON,
      webhooks: true,
      mcp: false,
      aiAssistant: true,
      imap: false,
    });
  });

  it('keeps an AI assistant the workspace switched off', () => {
    const settings = { plugins: { aiAssistant: false } };

    expect(readPluginSettings({ settings }).aiAssistant).toBe(false);
  });
});

describe('mergePluginSettings', () => {
  it('changes only the patched switch and keeps the rest of the settings', () => {
    const current = {
      profile: 'home',
      processing: { merchantLearning: false },
      plugins: { webhooks: true, mcp: false, aiAssistant: true },
    };

    expect(mergePluginSettings(current, { mcp: true })).toEqual({
      profile: 'home',
      processing: { merchantLearning: false },
      plugins: { webhooks: true, mcp: true, aiAssistant: true, ...INTEGRATIONS_ON },
    });
  });

  it('starts from the defaults on a workspace that never stored settings', () => {
    expect(mergePluginSettings(null, { webhooks: true })).toEqual({
      plugins: { webhooks: true, mcp: false, aiAssistant: true, ...INTEGRATIONS_ON },
    });
  });
});

describe('pluginOnSql', () => {
  it('writes SQL with the same default as the reader', () => {
    // On unless stored false: a workspace that never touched the switch is on.
    expect(pluginOnSql('w.settings', 'bankSync')).toBe(
      "(w.settings -> 'plugins' -> 'bankSync') IS DISTINCT FROM 'false'::jsonb",
    );
    // Off unless stored true.
    expect(pluginOnSql('w.settings', 'webhooks')).toBe(
      "(w.settings -> 'plugins' -> 'webhooks') = 'true'::jsonb",
    );
  });
});
