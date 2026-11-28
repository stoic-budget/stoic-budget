// @vitest-environment jsdom
import type { AuditEvent } from '@/lib/api/audit';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it } from 'vitest';
import { AuditTimeline } from './AuditTimeline';

const event = (id: string, overrides: Partial<AuditEvent>): AuditEvent => ({
  id,
  workspaceId: 'workspace-1',
  createdAt: '2026-03-12T19:06:44.950Z',
  actorType: 'user',
  actorId: 'user-1',
  actorLabel: 'member-1@example.com',
  entityType: 'statement',
  entityId: 'entity-1',
  action: 'import',
  diff: null,
  description: null,
  meta: null,
  batchId: null,
  severity: 'info',
  isUndoable: false,
  ...overrides,
});

const rows = async (events: AuditEvent[]) => {
  const container = document.createElement('div');
  const root = createRoot(container);
  await act(async () => {
    root.render(
      <AuditTimeline
        events={events}
        onSelect={() => undefined}
        page={1}
        limit={50}
        total={events.length}
        onPageChange={() => undefined}
      />,
    );
  });
  const found = [...container.querySelectorAll<HTMLElement>('.audit-item')].map(item => ({
    line: item.querySelector('.audit-line')?.textContent,
    hasPicture: item.querySelector('img, svg') !== null,
  }));
  act(() => root.unmount());
  return found;
};

describe('AuditTimeline rows', () => {
  it('names the member who acted by name, on one line with what they did', async () => {
    const [row] = await rows([
      event('e1', { actor: { name: 'Member One', email: 'member-1@example.com', avatarUrl: null } }),
    ]);
    expect(row?.line).toBe('Member One imported Statement');
    // No avatar, icon or type pill: the words say it.
    expect(row?.hasPicture).toBe(false);
  });

  it('falls back to the label for an actor that is no member', async () => {
    const [row] = await rows([
      event('e3', { actorType: 'system', actorId: null, actorLabel: 'Scheduler', actor: null }),
    ]);
    expect(row?.line?.startsWith('Scheduler ')).toBe(true);
  });
});

describe('AuditTimeline pagination', () => {
  const pager = async (total: number) => {
    const container = document.createElement('div');
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <AuditTimeline
          events={[event('e1', {})]}
          onSelect={() => undefined}
          page={1}
          limit={50}
          total={total}
          onPageChange={() => undefined}
        />,
      );
    });
    const found = container.querySelector('.audit-pagination');
    act(() => root.unmount());
    return found;
  };

  it('shows the pages only when there is more than one', async () => {
    expect(await pager(50)).toBeNull();
    expect((await pager(51))?.textContent).toContain('1');
  });
});
