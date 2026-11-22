import type { BankSyncClaim } from '../../../../src/modules/bank-sync/bank-sync-claims.service';
import {
  BankSyncAuthError,
  BankSyncTemporaryError,
} from '../../../../src/modules/bank-sync/bank-sync-provider.interface';
import { BankSyncSchedulerService } from '../../../../src/modules/bank-sync/bank-sync-scheduler.service';

const claim = (connectionId: string, workspaceId: string, failures = 0): BankSyncClaim => ({
  settingsId: `set-${connectionId}`,
  connectionId,
  workspaceId,
  userId: 'member-1',
  failures,
  leaseUntil: new Date('2026-11-10T12:30:00.000Z'),
});

const result = { ok: true as const, imported: 0, statements: 0, accounts: [] };

function harness(options: { batches?: BankSyncClaim[][]; sync?: (id: string) => Promise<unknown> }) {
  const batches = [...(options.batches ?? [])];
  const claims = {
    claimDue: vi.fn(async () => batches.shift() ?? []),
    claimOne: vi.fn(async (workspaceId: string, connectionId: string) =>
      claim(connectionId, workspaceId),
    ),
    recordSuccess: vi.fn(async () => undefined),
    recordFailure: vi.fn(async () => undefined),
    setInterval: vi.fn(async () => undefined),
  };
  const pulled: string[] = [];
  const pull = {
    sync: vi.fn(async (_user: unknown, _workspaceId: string, connectionId: string) => {
      pulled.push(connectionId);
      return options.sync ? options.sync(connectionId) : result;
    }),
  };
  const connections = {
    catalogue: () => [{ key: 'simplefin' }, { key: 'enablebanking' }],
    require: vi.fn(async () => ({ integration: {}, settings: { id: 'set-c1' } })),
    updateConnection: vi.fn(async () => ({ id: 'c1' })),
  };
  const integrations = {
    findOne: vi.fn(async ({ where }: { where: { id: string; workspaceId: string } }) => ({
      id: where.id,
      workspaceId: where.workspaceId,
      connectedByUser: { id: 'member-1' },
    })),
  };
  const scheduler = new BankSyncSchedulerService(
    integrations as never,
    connections as never,
    claims as never,
    pull as never,
  );
  return { scheduler, claims, pull, pulled, connections, integrations };
}

describe('BankSyncSchedulerService tick', () => {
  it('claims the due connections of every provider and pulls them workspace by workspace', async () => {
    const h = harness({
      batches: [[claim('c1', 'ws-a'), claim('c2', 'ws-b'), claim('c3', 'ws-a')], [claim('c4', 'ws-b')]],
    });
    await h.scheduler.tick();

    expect(h.claims.claimDue).toHaveBeenCalledWith(['simplefin', 'enablebanking'], 10);
    expect(h.pulled).toEqual(['c1', 'c3', 'c2', 'c4']);
    expect(h.claims.recordSuccess).toHaveBeenCalledTimes(4);
    // Stops once nothing is due.
    expect(h.claims.claimDue).toHaveBeenCalledTimes(3);
  });

  it('looks up who to pull as within the claimed workspace', async () => {
    const h = harness({ batches: [[claim('c1', 'ws-a')]] });
    await h.scheduler.tick();
    expect(h.integrations.findOne).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'c1', workspaceId: 'ws-a' } }),
    );
  });

  it('records a failed pull and goes on with the next connection', async () => {
    const limited = new BankSyncTemporaryError('HTTP 429', 7200);
    const h = harness({
      batches: [[claim('c1', 'ws-a', 2), claim('c2', 'ws-a')]],
      sync: async id => {
        if (id === 'c1') throw limited;
        return result;
      },
    });
    await h.scheduler.tick();

    expect(h.claims.recordFailure).toHaveBeenCalledWith(
      expect.objectContaining({ connectionId: 'c1', failures: 2 }),
      limited,
    );
    expect(h.claims.recordSuccess).toHaveBeenCalledWith(
      expect.objectContaining({ connectionId: 'c2' }),
    );
  });

  it('releases a connection whose member is gone instead of keeping its lease', async () => {
    const h = harness({ batches: [[claim('c1', 'ws-a')]] });
    h.integrations.findOne.mockResolvedValueOnce({ connectedByUser: null } as never);
    await h.scheduler.tick();
    expect(h.pull.sync).not.toHaveBeenCalled();
    expect(h.claims.recordFailure).toHaveBeenCalledTimes(1);
  });

  it('does not start a second tick while one is still running', async () => {
    let release: () => void = () => undefined;
    const h = harness({
      batches: [[claim('c1', 'ws-a')]],
      sync: () => new Promise(resolve => (release = () => resolve(result))),
    });
    const first = h.scheduler.tick();
    await vi.waitFor(() => expect(h.pull.sync).toHaveBeenCalled());
    await h.scheduler.tick();
    release();
    await first;
    expect(h.claims.claimDue).toHaveBeenCalledTimes(2);
  });
});

describe('BankSyncSchedulerService sync now', () => {
  it('checks the connection is the caller’s before claiming it', async () => {
    const h = harness({});
    h.connections.require.mockRejectedValueOnce(new Error('not found'));
    await expect(h.scheduler.syncNow({ id: 'member-1' } as never, 'ws-a', 'c9')).rejects.toThrow(
      'not found',
    );
    expect(h.claims.claimOne).not.toHaveBeenCalled();
  });

  it('records a refused credential and still answers the error', async () => {
    const refused = new BankSyncAuthError();
    const h = harness({
      sync: async () => {
        throw refused;
      },
    });
    await expect(h.scheduler.syncNow({ id: 'member-1' } as never, 'ws-a', 'c1')).rejects.toBe(
      refused,
    );
    expect(h.claims.recordFailure).toHaveBeenCalledWith(
      expect.objectContaining({ connectionId: 'c1' }),
      refused,
    );
  });

  it('records a good pull', async () => {
    const h = harness({});
    await h.scheduler.syncNow({ id: 'member-1' } as never, 'ws-a', 'c1');
    expect(h.claims.claimOne).toHaveBeenCalledWith('ws-a', 'c1');
    expect(h.claims.recordSuccess).toHaveBeenCalledTimes(1);
  });
});

describe('BankSyncSchedulerService settings', () => {
  it('stores a new interval only for a connection of the caller’s workspace', async () => {
    const h = harness({});
    await h.scheduler.updateConnection('ws-a', 'c1', { syncIntervalHours: 2 });
    expect(h.connections.require).toHaveBeenCalledWith('ws-a', 'c1');
    expect(h.claims.setInterval).toHaveBeenCalledWith({ id: 'set-c1' }, 2);
    expect(h.connections.updateConnection).toHaveBeenCalledWith('ws-a', 'c1', {
      syncIntervalHours: 2,
    });
  });

  it('leaves the schedule alone when only the label changes', async () => {
    const h = harness({});
    await h.scheduler.updateConnection('ws-a', 'c1', { label: 'Household' });
    expect(h.claims.setInterval).not.toHaveBeenCalled();
  });
});
