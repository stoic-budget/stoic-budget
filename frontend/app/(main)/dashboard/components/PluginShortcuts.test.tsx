import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PluginShortcuts } from './PluginShortcuts';

const openAppPanelMock = vi.hoisted(() => vi.fn());
const workspaceMock = vi.hoisted(() => ({
  current: null as { settings: Record<string, unknown> | null } | null,
}));

vi.mock('@/app/contexts/WorkspaceContext', () => ({
  useWorkspace: () => ({ currentWorkspace: workspaceMock.current }),
}));
vi.mock('@/app/components/panels/app-panels-store', () => ({
  openAppPanel: openAppPanelMock,
}));

const pluginButtons = () =>
  screen
    .getAllByRole('button')
    .filter(button => button.classList.contains('seneca-plugin-shortcuts__item'));

describe('PluginShortcuts', () => {
  beforeEach(() => {
    openAppPanelMock.mockReset();
    workspaceMock.current = { settings: null };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows the assistant alone on a workspace that never touched a switch', () => {
    render(<PluginShortcuts />);

    expect(pluginButtons().map(button => button.getAttribute('aria-label'))).toEqual([
      'AI Assistant',
    ]);
    fireEvent.click(screen.getByRole('button', { name: 'AI Assistant' }));
    expect(openAppPanelMock).toHaveBeenCalledWith('plugins', 'ai-assistant');
  });

  it('shows every switched-on plugin and opens each one', () => {
    workspaceMock.current = { settings: { plugins: { webhooks: true, mcp: true } } };
    render(<PluginShortcuts />);

    expect(pluginButtons()).toHaveLength(3);
    fireEvent.click(pluginButtons()[2]);
    expect(openAppPanelMock).toHaveBeenCalledWith('plugins', 'mcp-server');
  });

  it('is absent while every plugin is off', () => {
    workspaceMock.current = { settings: { plugins: { aiAssistant: false } } };
    render(<PluginShortcuts />);

    expect(screen.queryByRole('navigation')).toBeNull();
  });

  it('waits for the workspace, so a switched-off plugin never flashes in', () => {
    workspaceMock.current = null;
    render(<PluginShortcuts />);

    expect(screen.queryByRole('navigation')).toBeNull();
  });

  it('has no arrows while every icon fits', () => {
    workspaceMock.current = { settings: { plugins: { webhooks: true, mcp: true } } };
    render(<PluginShortcuts />);

    expect(screen.queryByRole('button', { name: 'More plugins' })).toBeNull();
  });

  it('pages through the icons with the arrows when some are hidden', () => {
    vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(200);
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(80);
    const scrollBy = vi.fn();
    HTMLElement.prototype.scrollBy = scrollBy;
    workspaceMock.current = { settings: { plugins: { webhooks: true, mcp: true } } };
    render(<PluginShortcuts />);

    expect(screen.getByRole('button', { name: 'Previous plugins' })).toHaveProperty(
      'disabled',
      true,
    );
    fireEvent.click(screen.getByRole('button', { name: 'More plugins' }));
    expect(scrollBy).toHaveBeenCalledWith({ left: 80, behavior: 'smooth' });
  });
});
