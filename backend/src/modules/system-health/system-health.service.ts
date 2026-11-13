import { Injectable } from '@nestjs/common';
import type { Queue } from 'bullmq';
import { DataSource } from 'typeorm';
import type { AdminSystemHealth, SystemHealthQueue } from '../../contracts';
import { configChecks, inspectBackupFolder } from './config-checks';
import { HealthRedisService, REDIS_PING_TIMEOUT_MS, within } from './health-redis.service';
import { overallLevel, type QueueFacts, queueVerdict, serviceVerdict } from './health-verdicts';
import { becameDueAt } from './queue-latency';
import { WorkerHeartbeatService } from './worker-heartbeat.service';

/** Queue figures read a few keys each; give them a little more than a ping. */
const QUEUE_READ_TIMEOUT_MS = 2 * REDIS_PING_TIMEOUT_MS;

/**
 * What the server depends on, checked for real. The public readiness answer is
 * only the database and Redis (a slow queue must not get a container marked
 * unhealthy and restarted); the instance admin gets everything.
 */
@Injectable()
export class SystemHealthService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly redis: HealthRedisService,
    private readonly heartbeat: WorkerHeartbeatService,
  ) {}

  pingRedis(): Promise<boolean> {
    return this.redis.ping();
  }

  async pingDatabase(): Promise<boolean> {
    try {
      await within(this.dataSource.query('SELECT 1'), 3 * REDIS_PING_TIMEOUT_MS);
      return true;
    } catch {
      return false;
    }
  }

  async details(openedOrigin: string | null, now: Date = new Date()): Promise<AdminSystemHealth> {
    const [databaseUp, redisUp] = await Promise.all([this.pingDatabase(), this.pingRedis()]);
    const [queues, lastSmtpSend, backupFolder] = await Promise.all([
      Promise.all(this.heartbeat.queues().map(queue => this.queueHealth(queue, redisUp, now))),
      redisUp ? this.redis.lastSmtpSend().catch(() => null) : Promise.resolve(null),
      inspectBackupFolder(process.env.BACKUP_LOCAL_ROOT),
    ]);
    const services = [serviceVerdict('database', databaseUp), serviceVerdict('redis', redisUp)];
    const config = configChecks({
      env: process.env,
      redisUp,
      lastSmtpSend,
      backupFolder,
      openedOrigin,
    });
    return {
      level: overallLevel([...services, ...queues, ...config].map(check => check.level)),
      checkedAt: now.toISOString(),
      services,
      queues,
      config,
    };
  }

  private async queueHealth(queue: Queue, redisUp: boolean, now: Date): Promise<SystemHealthQueue> {
    const facts: QueueFacts = {
      name: queue.name,
      redisUp,
      workerSeenAt: null,
      counts: null,
      oldestWaitingSince: null,
    };
    if (redisUp) {
      try {
        Object.assign(facts, await within(this.queueFacts(queue), QUEUE_READ_TIMEOUT_MS));
      } catch {
        // Redis went away between the ping and the read.
        facts.redisUp = false;
      }
    }
    return queueVerdict(facts, now);
  }

  private async queueFacts(queue: Queue): Promise<Partial<QueueFacts>> {
    const [workerSeenAt, counts, oldest] = await Promise.all([
      this.redis.workerSeenAt(queue.name),
      queue.getJobCounts('waiting', 'prioritized', 'delayed', 'active', 'failed'),
      queue.getJobs(['waiting'], 0, 0, true),
    ]);
    const first = oldest[0];
    const oldestWaitingSince = first ? await becameDueAt(this.redis, queue, first) : null;
    return {
      workerSeenAt,
      counts: {
        waiting: (counts.waiting ?? 0) + (counts.prioritized ?? 0),
        delayed: counts.delayed ?? 0,
        active: counts.active ?? 0,
        failed: counts.failed ?? 0,
      },
      oldestWaitingSince,
    };
  }
}
