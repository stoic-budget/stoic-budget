import { Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import { type ThrottlerStorage, ThrottlerStorageService } from '@nestjs/throttler';
import Redis from 'ioredis';

type ThrottlerStorageRecord = Awaited<ReturnType<ThrottlerStorage['increment']>>;

/**
 * One round trip per request, with the semantics of @nestjs/throttler's own
 * in-memory store: while a key is blocked its hits are not counted; past the
 * limit it is blocked for `blockDuration`, after which counting starts again
 * from one. (@nest-lab/throttler-storage-redis, which this replaces, let the
 * block key expire on its own and then blocked again for the rest of the hit
 * window, so a block outlived its duration.)
 */
const INCREMENT_SCRIPT = `
local hitKey = KEYS[1]
local blockKey = KEYS[2]
local ttl = tonumber(ARGV[1])
local limit = tonumber(ARGV[2])
local blockDuration = tonumber(ARGV[3])

local timeToBlockExpire = redis.call('PTTL', blockKey)
if timeToBlockExpire > 0 then
  local hits = tonumber(redis.call('GET', hitKey) or '0')
  local timeToExpire = math.max(redis.call('PTTL', hitKey), 0)
  return { hits, timeToExpire, 1, timeToBlockExpire }
end

local totalHits = redis.call('INCR', hitKey)
local timeToExpire = redis.call('PTTL', hitKey)
if timeToExpire <= 0 then
  redis.call('PEXPIRE', hitKey, ttl)
  timeToExpire = ttl
end

if totalHits > limit then
  if blockDuration > 0 then
    redis.call('SET', blockKey, 1, 'PX', blockDuration)
    -- The next window, once the block is over, starts from zero.
    redis.call('DEL', hitKey)
    return { totalHits, timeToExpire, 1, blockDuration }
  end
  return { totalHits, timeToExpire, 1, 0 }
end

return { totalHits, timeToExpire, 0, 0 }
`;

/** How long a request may wait on Redis before the in-process counters answer. */
export const THROTTLER_REDIS_TIMEOUT_MS = 500;

/**
 * Throttler counters in Redis, shared by every instance of the API (the
 * default in-memory store counts per process).
 *
 * The guard runs on nearly every route, so a Redis that is down or not
 * answering must not hang them all. Our own connection fails at once while
 * Redis is unreachable (no offline queue) and gives up on a command after
 * THROTTLER_REDIS_TIMEOUT_MS; until Redis answers again the limits are counted
 * in this process instead, so they still hold, per instance.
 */
@Injectable()
export class RedisThrottlerStorage implements ThrottlerStorage, OnModuleDestroy {
  private readonly logger = new Logger(RedisThrottlerStorage.name);
  private readonly redis: Redis;
  // A connection opened from a URL is ours to close; one handed in is not.
  private readonly ownsConnection: boolean;
  private usingFallback = false;

  constructor(
    redisOrUrl: Redis | string,
    private readonly fallback: ThrottlerStorageService = new ThrottlerStorageService(),
  ) {
    this.ownsConnection = typeof redisOrUrl === 'string';
    this.redis =
      typeof redisOrUrl === 'string'
        ? new Redis(redisOrUrl, {
            enableOfflineQueue: false,
            maxRetriesPerRequest: 1,
            commandTimeout: THROTTLER_REDIS_TIMEOUT_MS,
          })
        : redisOrUrl;
  }

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<ThrottlerStorageRecord> {
    // One hash tag for both keys, so they land on the same Redis Cluster slot.
    const prefix = `{${key}:${throttlerName}}`;
    let result: unknown;
    try {
      result = await this.redis.eval(
        INCREMENT_SCRIPT,
        2,
        `${prefix}:hits`,
        `${prefix}:blocked`,
        ttl,
        limit,
        blockDuration,
      );
    } catch (error) {
      if (!this.usingFallback) {
        this.usingFallback = true;
        this.logger.warn(
          `Redis did not answer the throttler (${error instanceof Error ? error.message : String(error)}); counting limits in this process until it does`,
        );
      }
      return this.fallback.increment(key, ttl, limit, blockDuration, throttlerName);
    }
    if (this.usingFallback) {
      this.usingFallback = false;
      this.logger.log(
        'Redis answers the throttler again; limits are shared across instances again',
      );
    }
    if (!Array.isArray(result) || result.length !== 4 || !result.every(Number.isFinite)) {
      throw new TypeError(`Unexpected throttler script result: ${JSON.stringify(result)}`);
    }
    const [totalHits, timeToExpire, isBlocked, timeToBlockExpire] = result as number[];
    return {
      totalHits,
      // The throttler works in seconds; Redis answers in milliseconds.
      timeToExpire: Math.ceil(timeToExpire / 1000),
      isBlocked: isBlocked === 1,
      timeToBlockExpire: Math.ceil(timeToBlockExpire / 1000),
    };
  }

  onModuleDestroy(): void {
    this.fallback.onApplicationShutdown();
    if (this.ownsConnection) {
      this.redis.disconnect(false);
    }
  }
}
