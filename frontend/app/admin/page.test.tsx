import type { AuditEvent } from '@/lib/api/audit';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ParserHealth } from '@/app/lib/contracts';
import { systemHealth } from '@/app/test/fixtures/contracts';

const fetchAuditEvents = vi.hoisted(() => vi.fn());
const apiQueryDecoded = vi.hoisted(() => vi.fn());
const auth = vi.hoisted(() => ({ user: { role: 'user' } as { role: string } | null }));

vi.mock('@/app/hooks/useAuth', () => ({ useAuth: () => auth }));
vi.mock('@/app/hooks/useWorkspaceId', () => ({ useWorkspaceId: () => 'workspace-1' }));
vi.mock('@/app/lib/query-fn-schema', () => ({ apiQueryDecoded }));

vi.mock('@/lib/api/audit', async importOriginal => ({
  ...(await importOriginal<typeof import('@/lib/api/audit')>()),
  fetchAuditEvents,
}));

// Imported once at collection: a dynamic import inside a test spends its
// timeout on the module graph under a loaded run.
import AdminPage from './page';

const auditEvent: AuditEvent = {
  id: 'event-1',
  workspaceId: 'workspace-1',
  createdAt: '2026-02-01T12:00:00.000Z',
  actorType: 'user',
  actorId: 'user-1',
  actorLabel: 'Member One',
  entityType: 'transaction',
  entityId: 'txn-123',
  action: 'update',
  description: 'Changed the transaction amount',
  diff: {
    before: { amount: 10 },
    after: { amount: 20 },
  },
  meta: null,
  batchId: null,
  severity: 'warn',
  isUndoable: true,
};

const parserHealth: ParserHealth = {
  since: '2026-01-01T00:00:00.000Z',
  banks: [
    {
      bank: 'other',
      statements: 4,
      needsReview: 0,
      errors: 1,
      declined: 0,
      reasons: [],
      layouts: [],
    },
  ],
};

const flushPromises = () => new Promise(resolve => setTimeout(resolve, 0));

const renderPage = async () => {
  const container = document.createElement('div');
  const root = createRoot(container);
  await act(async () => {
    root.render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <AdminPage />
      </QueryClientProvider>,
    );
  });
  await act(async () => {
    await flushPromises();
  });
  return { container, unmount: () => act(() => root.unmount()) };
};

describe('AdminPage', () => {
  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    fetchAuditEvents.mockReset();
    apiQueryDecoded.mockReset();
    fetchAuditEvents.mockResolvedValue({ data: [], total: 0, page: 1, limit: 50 });
    apiQueryDecoded.mockImplementation(async ({ url }: { url: string }) =>
      url === '/parsing/health' ? parserHealth : systemHealth({ level: 'ok' }),
    );
    auth.user = { role: 'user' };
  });

  it('lists the activity on one line an event: who, did what, to what', async () => {
    fetchAuditEvents.mockResolvedValue({ data: [auditEvent], total: 1, page: 1, limit: 50 });
    const { container, unmount } = await renderPage();

    expect(fetchAuditEvents).toHaveBeenCalledWith({ page: 1, limit: 50 });
    expect(container.querySelector('.audit-filter-bar input.audit-search')).toBeTruthy();
    const items = container.querySelectorAll('.audit-timeline-card .audit-item');
    expect(items).toHaveLength(1);
    expect(items[0]?.querySelector('.audit-actor')?.textContent).toBe(auditEvent.actorLabel);
    unmount();
  });

  it('shows the server administrator, and no one else, how parsing and the server are', async () => {
    auth.user = { role: 'admin' };
    const admin = await renderPage();
    const parsingRow = admin.container.querySelector('a[href="/admin/parsing"]');
    const healthRow = admin.container.querySelector('a[href="/admin/health"]');
    // Even a failed statement is "worth a look": "not working" is for outages. The server is fine.
    expect(parsingRow?.textContent).toBe('Parser healthWorth a look');
    expect(healthRow?.textContent).toBe('Server healthWorking');
    admin.unmount();

    auth.user = { role: 'user' };
    apiQueryDecoded.mockClear();
    const member = await renderPage();
    expect(member.container.querySelector('a[href="/admin/parsing"]')).toBeNull();
    expect(apiQueryDecoded).not.toHaveBeenCalled();
    member.unmount();
  });
});
