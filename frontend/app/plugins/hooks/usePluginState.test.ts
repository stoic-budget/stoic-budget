import { describe, expect, it } from 'vitest';
import { readPluginSwitch } from './usePluginState';

describe('readPluginSwitch', () => {
  it('maps each plugin to its key in workspace.settings.plugins', () => {
    const settings = { plugins: { aiAssistant: true, webhooks: false, mcp: true } };

    expect(readPluginSwitch(settings, 'ai-assistant')).toBe(true);
    expect(readPluginSwitch(settings, 'webhooks')).toBe(false);
    expect(readPluginSwitch(settings, 'mcp-server')).toBe(true);
  });

  it('gives a missing or malformed switch its default, as the server does', () => {
    expect(readPluginSwitch(null, 'webhooks')).toBe(false);
    expect(readPluginSwitch({}, 'webhooks')).toBe(false);
    expect(readPluginSwitch({ plugins: 'on' }, 'webhooks')).toBe(false);
    expect(readPluginSwitch({ plugins: { webhooks: 'true' } }, 'webhooks')).toBe(false);
    expect(readPluginSwitch({}, 'mcp-server')).toBe(false);
    expect(readPluginSwitch({}, 'ai-assistant')).toBe(true);
    expect(readPluginSwitch({ plugins: { aiAssistant: 'no' } }, 'ai-assistant')).toBe(true);
  });

  it('keeps an AI assistant the workspace switched off', () => {
    expect(readPluginSwitch({ plugins: { aiAssistant: false } }, 'ai-assistant')).toBe(false);
  });
});
