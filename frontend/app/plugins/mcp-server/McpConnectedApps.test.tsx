import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { McpConnectedApps } from './McpConnectedApps';

const state = vi.hoisted(() => ({ disconnect: vi.fn(), workspaceWide: false }));

vi.mock('./useConnectedApps', () => ({
  useConnectedApps: () => ({
    apps: [
      {
        id: 'grant-1',
        clientName: 'ACME Assistant',
        redirectHosts: ['127.0.0.1:33418'],
        scopes: ['transaction.view', 'category.view'],
        createdAt: '2026-11-01T10:00:00.000Z',
        lastUsedAt: null,
        ...(state.workspaceWide ? { memberName: 'Member Two' } : {}),
      },
    ],
    workspaceWide: state.workspaceWide,
    loading: false,
    disconnect: state.disconnect,
    disconnecting: false,
  }),
}));

describe('McpConnectedApps', () => {
  beforeEach(() => {
    state.disconnect.mockReset();
    state.workspaceWide = false;
  });

  it('names each app with where it sends people and what it may do', () => {
    render(<McpConnectedApps />);

    const text = document.body.textContent ?? '';
    expect(text).toContain('ACME Assistant');
    expect(text).toContain('127.0.0.1:33418');
    expect(text).toMatch(/2/);
  });

  it('shows a manager every member’s apps, each with who connected it', () => {
    state.workspaceWide = true;
    render(<McpConnectedApps />);

    const text = document.body.textContent ?? '';
    expect(text).toContain('Connected apps in this workspace');
    expect(text).toContain('Member Two · 127.0.0.1:33418');
    expect(text).toMatch(/connected \S/);

    fireEvent.click(screen.getByRole('button', { name: 'Disconnect: ACME Assistant · Member Two' }));
    expect(document.body.textContent).toContain('has to be approved again');
  });

  it('leaves out member names and the workspace title in the own list', () => {
    render(<McpConnectedApps />);

    const text = document.body.textContent ?? '';
    expect(text).not.toContain('in this workspace');
    expect(text).not.toContain('Member Two');
  });

  it('disconnects only after the person confirms', () => {
    render(<McpConnectedApps />);

    fireEvent.click(screen.getByRole('button', { name: /Disconnect: ACME Assistant/ }));
    expect(state.disconnect).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Disconnect' }));
    expect(state.disconnect).toHaveBeenCalledWith('grant-1');
  });
});
