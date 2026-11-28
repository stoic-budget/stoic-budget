import type React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PluginsPanel } from './PluginsPanel';

const setPluginsMock = vi.hoisted(() => vi.fn());
const openItemMock = vi.hoisted(() => vi.fn());
const toastErrorMock = vi.hoisted(() => vi.fn());
const panelState = vi.hoisted(() => ({ current: { panel: 'plugins', item: null as string | null } }));
const workspaceMock = vi.hoisted(() => ({
  current: {
    id: 'ws-1',
    memberRole: 'owner',
    settings: null as Record<string, unknown> | null,
  },
}));

vi.mock('@/app/contexts/WorkspaceContext', () => ({
  useWorkspace: () => ({
    currentWorkspace: workspaceMock.current,
    setWorkspacePlugins: setPluginsMock,
  }),
}));
vi.mock('react-hot-toast', () => ({ default: { error: toastErrorMock, success: vi.fn() } }));
vi.mock('@/app/components/panels/app-panels-store', () => ({
  useAppPanelState: () => panelState.current,
  closeAppPanel: vi.fn(),
  closeAppPanelItem: vi.fn(),
  openAppPanelItem: openItemMock,
}));
vi.mock('../ai-assistant/AiAssistantDrawer', () => ({ AiAssistantDrawer: () => null }));
vi.mock('../webhooks/WebhooksDrawer', () => ({ WebhooksDrawer: () => null }));
vi.mock('../mcp-server/McpServerDrawer', () => ({ McpServerDrawer: () => null }));
vi.mock('../hooks/useIntegrationStatuses', () => ({
  useIntegrationStatuses: () => ({ statuses: { imap: true }, refresh: vi.fn() }),
}));
// The settings layer loads its form from the API; only what sits above it matters here.
vi.mock('@/app/integrations/panel/IntegrationDetailDrawer', () => ({
  IntegrationDetailDrawer: ({
    entry,
    banner,
  }: {
    entry?: { name: string };
    banner: React.ReactNode;
  }) => (entry ? <section data-testid={`layer-${entry.name}`}>{banner}</section> : null),
}));

const switchOf = (name: string) => screen.getByRole('switch', { name: new RegExp(`Toggle ${name}`) });

describe('PluginsPanel', () => {
  beforeEach(() => {
    panelState.current = { panel: 'plugins', item: null };
    setPluginsMock.mockReset();
    toastErrorMock.mockReset();
    workspaceMock.current = {
      id: 'ws-1',
      memberRole: 'owner',
      settings: { plugins: { webhooks: true, mcp: false, aiAssistant: false } },
    };
  });

  it('shows the switches stored on the workspace', () => {
    render(<PluginsPanel />);

    expect(switchOf('Webhooks')).toBeChecked();
    expect(switchOf('MCP')).not.toBeChecked();
    expect(switchOf('AI')).not.toBeChecked();
  });

  it('saves a flipped switch on the workspace', async () => {
    setPluginsMock.mockResolvedValue(undefined);
    render(<PluginsPanel />);

    fireEvent.click(switchOf('MCP'));

    await waitFor(() =>
      expect(setPluginsMock).toHaveBeenCalledWith({ workspaceId: 'ws-1', plugins: { mcp: true } }),
    );
  });

  it('tells the user when the switch could not be saved', async () => {
    setPluginsMock.mockRejectedValue(new Error('403'));
    render(<PluginsPanel />);

    fireEvent.click(switchOf('Webhooks'));

    await waitFor(() => expect(toastErrorMock).toHaveBeenCalledTimes(1));
  });

  it('lets a member see the switches but not flip them', () => {
    workspaceMock.current = { ...workspaceMock.current, memberRole: 'member' };
    render(<PluginsPanel />);

    expect(switchOf('Webhooks')).toBeDisabled();
    expect(switchOf('MCP')).toBeDisabled();
  });

  it('does not open the AI assistant while it is off', () => {
    render(<PluginsPanel />);

    expect(screen.getByRole('button', { name: /^AI Assistant/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /^Webhooks/ })).toBeEnabled();
  });

  it('lists the integrations under the plugins, each switched on until the workspace says otherwise', () => {
    workspaceMock.current = {
      ...workspaceMock.current,
      settings: { plugins: { webhooks: true, bankSync: false } },
    };
    render(<PluginsPanel />);

    expect(switchOf('IMAP inbox')).toBeChecked();
    expect(switchOf('SMTP email')).toBeChecked();
    expect(switchOf('Bank sync')).not.toBeChecked();
    expect(document.querySelector('[data-integration-card="imap"]')?.textContent).toContain(
      'Connected',
    );
    // File stores and the app address are in Settings now.
    expect(document.querySelector('[data-integration-card="s3-compatible"]')).toBeNull();
    expect(document.querySelector('[data-integration-card="app-url"]')).toBeNull();
  });

  it('saves an integration switch under its settings key', async () => {
    setPluginsMock.mockResolvedValue(undefined);
    render(<PluginsPanel />);

    fireEvent.click(switchOf('Bank sync'));

    await waitFor(() =>
      expect(setPluginsMock).toHaveBeenCalledWith({
        workspaceId: 'ws-1',
        plugins: { bankSync: false },
      }),
    );
  });

  it('searches plugins and integrations together', () => {
    render(<PluginsPanel />);

    fireEvent.change(screen.getByPlaceholderText(/Search plugins and integrations/), {
      target: { value: 'imap' },
    });

    expect(switchOf('IMAP inbox')).toBeTruthy();
    expect(screen.queryByRole('switch', { name: /Toggle Webhooks/ })).toBeNull();
    expect(screen.queryByRole('switch', { name: /Toggle SMTP/ })).toBeNull();
  });

  it('opens a paused integration with the notice that it is off', () => {
    workspaceMock.current = {
      ...workspaceMock.current,
      settings: { plugins: { imap: false } },
    };
    panelState.current = { panel: 'plugins', item: 'imap' };
    render(<PluginsPanel />);

    const layer = screen.getByTestId('layer-IMAP inbox');
    expect(layer.textContent).toContain('IMAP inbox is off');
  });

  it('opens an integration from its row even while it is switched off', () => {
    workspaceMock.current = { ...workspaceMock.current, settings: { plugins: { peppol: false } } };
    openItemMock.mockReset();
    render(<PluginsPanel />);

    const row = document.querySelector('[data-integration-card="peppol"] button') as HTMLElement;
    expect(row).toBeEnabled();
    fireEvent.click(row);

    expect(openItemMock).toHaveBeenCalledWith('peppol');
  });

  it('lists the plugins first, then mail, bank and messaging', () => {
    render(<PluginsPanel />);

    const order = [...document.querySelectorAll('[role="switch"]')].map(node =>
      node.getAttribute('aria-label'),
    );
    const first = (name: string) => order.findIndex(label => label?.includes(name));
    expect(first('MCP')).toBeLessThan(first('SMTP'));
    expect(first('SMTP')).toBeLessThan(first('Bank sync'));
    expect(first('Bank sync')).toBeLessThan(first('Telegram'));
  });

  it('holds every switch while one is being saved', async () => {
    let finish: () => void = () => undefined;
    setPluginsMock.mockImplementation(() => new Promise<void>(resolve => (finish = resolve)));
    render(<PluginsPanel />);

    fireEvent.click(switchOf('IMAP inbox'));

    await waitFor(() => expect(switchOf('SMTP email')).toBeDisabled());
    finish();
    await waitFor(() => expect(switchOf('SMTP email')).toBeEnabled());
  });
});
