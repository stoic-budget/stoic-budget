// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AuditEvent } from '@/lib/api/audit';
import { AuditEventModal } from './AuditEventModal';

const event: AuditEvent = {
  id: 'event-1',
  workspaceId: 'workspace-1',
  createdAt: '2026-11-28T12:00:00.000Z',
  actorType: 'user',
  actorId: 'user-1',
  actorLabel: 'member-1@example.com',
  entityType: 'category',
  entityId: 'category-1',
  action: 'update',
  diff: { before: { name: 'Example' }, after: { name: 'Example renamed' } },
  description: null,
  meta: null,
  batchId: null,
  severity: 'info',
  isUndoable: true,
};

const renderModal = (isOpen = true) => {
  const onRollback = vi.fn();
  const onClose = vi.fn();
  const view = render(
    <AuditEventModal event={event} isOpen={isOpen} onClose={onClose} onRollback={onRollback} />,
  );
  return { onRollback, onClose, view };
};

describe('AuditEventModal rollback', () => {
  afterEach(cleanup);

  it('is a quiet text button that asks once more before it undoes anything', async () => {
    const { onRollback } = renderModal();
    const user = userEvent.setup();

    const first = screen.getByRole('button', { name: 'Rollback' });
    expect(first.className).toContain('MuiButton-text');

    await user.click(first);
    expect(onRollback).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Confirm rollback' }));
    expect(onRollback).toHaveBeenCalledTimes(1);
    expect(onRollback).toHaveBeenCalledWith(event);
  });

  it('forgets the first click once the window is closed', async () => {
    const { onRollback, onClose, view } = renderModal();
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Rollback' }));
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalled();

    view.rerender(
      <AuditEventModal event={event} isOpen onClose={onClose} onRollback={onRollback} />,
    );
    expect(screen.getByRole('button', { name: 'Rollback' })).toBeTruthy();
    expect(onRollback).not.toHaveBeenCalled();
  });
});
