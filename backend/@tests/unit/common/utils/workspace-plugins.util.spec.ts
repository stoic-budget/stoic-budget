import {
  mergePluginSettings,
  pluginOnSql,
  readPluginSettings,
} from '@/common/utils/workspace-plugins.util';

describe('workspace plugin switches', () => {
  it('starts integrations on and the opt-in plugins off', () => {
    expect(readPluginSettings({ settings: null })).toEqual({
      webhooks: false,
      mcp: false,
      aiAssistant: true,
      smtp: true,
      imap: true,
      bankSync: true,
      peppol: true,
      telegram: true,
    });
  });

  it('switches one integration off and keeps the others and every other setting', () => {
    const next = mergePluginSettings({ processing: { merchantLearning: false } }, { peppol: false });

    expect(next.processing).toEqual({ merchantLearning: false });
    expect(readPluginSettings({ settings: next })).toMatchObject({ peppol: false, imap: true });
  });

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
