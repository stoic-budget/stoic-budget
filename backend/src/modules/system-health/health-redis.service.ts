import { Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';

/** A health check answers fast or not at all: a hung Redis must not hang readiness. */
export const REDIS_PING_TIMEOUT_MS = 1000;
/** Heartbeats and the last mail outlive a restart, so "not running since …" can name a time. */
const SIGNAL_TTL_SECONDS = 7 * 24 * 60 * 60;
const WORKER_KEY = (queue: string) => `health:worker:${queue}`;
const SMTP_KEY = 'health:smtp:last';

export function within<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`timed out after ${ms} ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

const parseDate = (value: unknown): Date | null => {
  if (typeof value !== 'string') return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

/**
 * Its own Redis connection for the health checks, with the offline queue off:
 * while Redis is down a command fails at once instead of waiting for a
 * reconnect, so the answer is "down", not a hang. It also keeps the signals
 * other parts leave for the checks: worker heartbeats and the last mail sent.
 */
@Injectable()
export class HealthRedisService implements OnModuleDestroy {
  private readonly logger = new Logger(HealthRedisService.name);
  private readonly client: Redis;
  private down = false;

  constructor() {
    this.client = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
      connectTimeout: 2000,
    });
    // One line per outage, not one per reconnect attempt.
    this.client.on('error', error => {
      if (!this.down) {
        this.down = true;
        this.logger.warn(`Redis unreachable for health checks: ${error.message}`);
      }
    });
    this.client.on('ready', () => {
      this.down = false;
    });
  }

  async onModuleDestroy(): Promise<void> {
    this.client.disconnect();
  }

  async ping(): Promise<boolean> {
    try {
      return (await within(this.client.ping(), REDIS_PING_TIMEOUT_MS)) === 'PONG';
    } catch {
      return false;
    }
  }

  async recordWorkerHeartbeat(queue: string, at: Date): Promise<void> {
    await within(
      this.client.set(WORKER_KEY(queue), at.toISOString(), 'EX', SIGNAL_TTL_SECONDS),
      REDIS_PING_TIMEOUT_MS,
    );
  }

  async workerSeenAt(queue: string): Promise<Date | null> {
    return parseDate(await within(this.client.get(WORKER_KEY(queue)), REDIS_PING_TIMEOUT_MS));
  }

  /** Up to `count` entries of a stream, newest first, from `end` (inclusive) back. */
  async streamPage(key: string, end: string, count: number): Promise<[string, string[]][]> {
    return within(this.client.xrevrange(key, end, '-', 'COUNT', count), REDIS_PING_TIMEOUT_MS);
  }

  /** Never throws: a mail that went out must not fail because Redis is down. */
  async recordSmtpSend(ok: boolean, at: Date = new Date()): Promise<void> {
    try {
      await within(
        this.client.set(
          SMTP_KEY,
          JSON.stringify({ ok, at: at.toISOString() }),
          'EX',
          SIGNAL_TTL_SECONDS,
        ),
        REDIS_PING_TIMEOUT_MS,
      );
    } catch {
      // The check reads "unknown" while Redis is down anyway.
    }
  }

  async lastSmtpSend(): Promise<{ ok: boolean; at: Date } | null> {
    const raw = await within(this.client.get(SMTP_KEY), REDIS_PING_TIMEOUT_MS);
    if (!raw) return null;
    try {
      const parsed: unknown = JSON.parse(raw);
      if (typeof parsed !== 'object' || parsed === null) return null;
      const { ok, at } = parsed as Record<string, unknown>;
      const date = parseDate(at);
      return typeof ok === 'boolean' && date ? { ok, at: date } : null;
    } catch {
      return null;
    }
  }
}
