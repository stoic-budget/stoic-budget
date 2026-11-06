import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AiAssistantButton } from './AiAssistantButton';

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

describe('AiAssistantButton', () => {
  beforeEach(() => {
    openAppPanelMock.mockReset();
    workspaceMock.current = { settings: null };
  });

  it('opens the assistant drawer on a workspace that never touched the switch', () => {
    render(<AiAssistantButton />);

    fireEvent.click(screen.getByRole('button', { name: 'AI Assistant' }));

    expect(openAppPanelMock).toHaveBeenCalledWith('plugins', 'ai-assistant');
  });

  it('is absent while the workspace has the assistant off', () => {
    workspaceMock.current = { settings: { plugins: { aiAssistant: false } } };
    render(<AiAssistantButton />);

    expect(screen.queryByRole('button')).toBeNull();
  });

  it('waits for the workspace, so a switched-off assistant never flashes in', () => {
    workspaceMock.current = null;
    render(<AiAssistantButton />);

    expect(screen.queryByRole('button')).toBeNull();
  });
});
