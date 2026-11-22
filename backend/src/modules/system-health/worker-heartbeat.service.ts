import { WorkerHost } from '@nestjs/bullmq';
import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
} from '@nestjs/common';
import { DiscoveryService } from '@nestjs/core';
import { Queue } from 'bullmq';
import { HealthRedisService } from './health-redis.service';
import { HEARTBEAT_INTERVAL_MS } from './health-verdicts';

/**
 * Every BullMQ worker in this process records a heartbeat while it runs, so the
 * health page can tell "no worker takes these jobs since …" from "the queue is
 * slow". A worker that was closed, or a Redis that cannot be written, leaves
 * the heartbeat to go stale.
 */
@Injectable()
export class WorkerHeartbeatService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(WorkerHeartbeatService.name);
  private timer: NodeJS.Timeout | undefined;

  constructor(
    private readonly discovery: DiscoveryService,
    private readonly redis: HealthRedisService,
  ) {}

  onApplicationBootstrap(): void {
    void this.beat();
    this.timer = setInterval(() => void this.beat(), HEARTBEAT_INTERVAL_MS);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    clearInterval(this.timer);
  }

  /** The queues registered anywhere in the app, by name. */
  queues(): Queue[] {
    const byName = new Map<string, Queue>();
    for (const { instance } of this.discovery.getProviders()) {
      if (instance instanceof Queue && !byName.has(instance.name)) {
        byName.set(instance.name, instance);
      }
    }
    return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
  }

  /** Writes a heartbeat for each running worker; the names of those it wrote. */
  async beat(now: Date = new Date()): Promise<string[]> {
    const running = this.runningWorkers();
    const written: string[] = [];
    await Promise.all(
      running.map(async name => {
        try {
          await this.redis.recordWorkerHeartbeat(name, now);
          written.push(name);
        } catch (error) {
          this.logger.debug(`Heartbeat for ${name} not written: ${(error as Error).message}`);
        }
      }),
    );
    return written;
  }

  private runningWorkers(): string[] {
    const names = new Set<string>();
    for (const { instance } of this.discovery.getProviders()) {
      if (!(instance instanceof WorkerHost)) continue;
      try {
        if (instance.worker.isRunning()) names.add(instance.worker.name);
      } catch {
        // Not initialised yet: no heartbeat until it runs.
      }
    }
    return [...names];
  }
}
