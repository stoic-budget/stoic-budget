import { WorkerHost } from '@nestjs/bullmq';
import type { DiscoveryService } from '@nestjs/core';
import type { HealthRedisService } from '@/modules/system-health/health-redis.service';
import { WorkerHeartbeatService } from '@/modules/system-health/worker-heartbeat.service';

class FakeHost extends WorkerHost {
  constructor(private readonly fake: { name: string; isRunning: () => boolean } | null) {
    super();
  }
  override get worker(): never {
    if (!this.fake) throw new Error('"Worker" has not yet been initialized');
    return this.fake as never;
  }
  async process(): Promise<void> {}
}

const discoveryOf = (instances: unknown[]) =>
  ({ getProviders: () => instances.map(instance => ({ instance })) }) as unknown as DiscoveryService;

describe('WorkerHeartbeatService', () => {
  const now = new Date('2026-11-10T12:00:00.000Z');

  it('writes a heartbeat for running workers only', async () => {
    const recordWorkerHeartbeat = vi.fn(async () => undefined);
    const service = new WorkerHeartbeatService(
      discoveryOf([
        new FakeHost({ name: 'statement-parsing', isRunning: () => true }),
        new FakeHost({ name: 'ledger-sync', isRunning: () => false }),
        new FakeHost(null),
        { unrelated: true },
      ]),
      { recordWorkerHeartbeat } as unknown as HealthRedisService,
    );

    await expect(service.beat(now)).resolves.toEqual(['statement-parsing']);
    expect(recordWorkerHeartbeat).toHaveBeenCalledTimes(1);
    expect(recordWorkerHeartbeat).toHaveBeenCalledWith('statement-parsing', now);
  });

  it('leaves the heartbeat stale when Redis refuses the write', async () => {
    const service = new WorkerHeartbeatService(
      discoveryOf([new FakeHost({ name: 'statement-parsing', isRunning: () => true })]),
      {
        recordWorkerHeartbeat: vi.fn(async () => {
          throw new Error('Stream isn\'t writeable');
        }),
      } as unknown as HealthRedisService,
    );

    await expect(service.beat(now)).resolves.toEqual([]);
  });
});
