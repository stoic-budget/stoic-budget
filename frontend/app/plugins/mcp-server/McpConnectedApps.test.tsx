import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { McpConnectedApps } from './McpConnectedApps';

const state = vi.hoisted(() => ({ disconnect: vi.fn() }));

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
      },
    ],
    loading: false,
    disconnect: state.disconnect,
    disconnecting: false,
  }),
}));

describe('McpConnectedApps', () => {
  beforeEach(() => state.disconnect.mockReset());

  it('names each app with where it sends people and what it may do', () => {
    render(<McpConnectedApps />);

    const text = document.body.textContent ?? '';
    expect(text).toContain('ACME Assistant');
    expect(text).toContain('127.0.0.1:33418');
    expect(text).toMatch(/2/);
  });

  it('disconnects only after the person confirms', () => {
    render(<McpConnectedApps />);

    fireEvent.click(screen.getByRole('button', { name: /Disconnect: ACME Assistant/ }));
    expect(state.disconnect).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Disconnect' }));
    expect(state.disconnect).toHaveBeenCalledWith('grant-1');
  });
});
