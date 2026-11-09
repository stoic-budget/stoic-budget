import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ConsentForm, chosenScopes } from './ConsentForm';


const shared = {
  id: '00000000-0000-4000-8000-0000000000aa',
  name: 'ACME Household',
  mcpEnabled: true,
  read: ['transaction.view' as const, 'category.view' as const],
  write: ['transaction.view' as const, 'category.view' as const, 'category.create' as const],
};
const off = { ...shared, id: '00000000-0000-4000-8000-0000000000bb', name: 'ACME Side', mcpEnabled: false };
const consent = (patch = {}) => ({
  kind: 'consent' as const,
  clientName: 'ACME Assistant',
  redirectHost: '127.0.0.1:33418',
  requestedScopes: [],
  workspaces: [shared, off],
  ...patch,
});

describe('chosenScopes', () => {
  it('sends the preset of the picked workspace', () => {
    expect(chosenScopes(shared, 'read', [])).toEqual(shared.read);
    expect(chosenScopes(shared, 'write', [])).toEqual(shared.write);
  });

  it('cuts a custom choice to what the workspace allows', () => {
    expect(chosenScopes({ ...shared, write: ['transaction.view'] }, 'custom', ['transaction.view', 'category.create'])).toEqual([
      'transaction.view',
    ]);
    expect(chosenScopes(undefined, 'read', [])).toEqual([]);
  });
});

describe('ConsentForm', () => {
  it('shows who asks and where the answer goes', () => {
    render(<ConsentForm consent={consent()} deciding={false} error={null} onDecide={vi.fn()} />);

    expect(screen.getByRole('heading', { name: 'Connect ACME Assistant' })).toBeInTheDocument();
    expect(document.body.textContent).toContain('127.0.0.1:33418');
  });

  it('shows a registered name as written, replacement patterns included', () => {
    render(
      <ConsentForm
        consent={consent({ clientName: 'ACME $& Sync $`' })}
        deciding={false}
        error={null}
        onDecide={vi.fn()}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Connect ACME $& Sync $`' })).toBeInTheDocument();
  });

  it('approves read-only in the first workspace with MCP on by default', () => {
    const onDecide = vi.fn();
    render(<ConsentForm consent={consent()} deciding={false} error={null} onDecide={onDecide} />);

    fireEvent.click(screen.getByRole('button', { name: 'Allow' }));
    expect(onDecide).toHaveBeenCalledWith({
      approve: true,
      workspaceId: shared.id,
      scopes: shared.read,
    });
  });

  it('offers only what the app asked for when it asked', () => {
    const onDecide = vi.fn();
    render(
      <ConsentForm
        consent={consent({ requestedScopes: ['category.view'] })}
        deciding={false}
        error={null}
        onDecide={onDecide}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Allow' }));
    expect(onDecide).toHaveBeenCalledWith(
      expect.objectContaining({ approve: true, scopes: ['category.view'] }),
    );
  });

  it('denies without scopes', () => {
    const onDecide = vi.fn();
    render(<ConsentForm consent={consent()} deciding={false} error={null} onDecide={onDecide} />);

    fireEvent.click(screen.getByRole('button', { name: 'Deny' }));
    expect(onDecide).toHaveBeenCalledWith({ approve: false, workspaceId: shared.id, scopes: [] });
  });

  it('cannot approve when MCP is off everywhere', () => {
    render(
      <ConsentForm
        consent={consent({ workspaces: [off] })}
        deciding={false}
        error={null}
        onDecide={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Allow' })).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent(/MCP is off in all your workspaces/);
  });
});
