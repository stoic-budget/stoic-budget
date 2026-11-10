import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { createHash } from 'crypto';
import Redis from 'ioredis';

const PREFIX = 'oidc:';

/** Hashed, so neither the state nor a ticket can be read back out of Redis. */
const keyOf = (kind: string, secret: string): string =>
  `${PREFIX}${kind}:${createHash('sha256').update(secret).digest('hex')}`;

/**
 * Short-lived, single-use records of a sign-in in flight: the authorization
 * request (state, nonce, PKCE verifier) and the finished sign-in waiting for
 * the second factor. Kept in Redis so every API instance sees them, and taken
 * with GETDEL so a replayed state or ticket finds nothing.
 */
@Injectable()
export class OidcStateStore implements OnModuleDestroy {
  private readonly redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
    lazyConnect: true,
    maxRetriesPerRequest: 2,
  });

  async put(kind: string, secret: string, record: object, ttlSeconds: number): Promise<void> {
    await this.redis.set(keyOf(kind, secret), JSON.stringify(record), 'EX', ttlSeconds);
  }

  /** Reads without consuming: a wrong second-factor code may be typed again. */
  async peek<T>(kind: string, secret: string): Promise<T | null> {
    const raw = await this.redis.get(keyOf(kind, secret));
    return raw ? (JSON.parse(raw) as T) : null;
  }

  /** Reads and deletes in one step: of two callers, only one gets the record. */
  async take<T>(kind: string, secret: string): Promise<T | null> {
    const raw = await this.redis.getdel(keyOf(kind, secret));
    return raw ? (JSON.parse(raw) as T) : null;
  }

  /** Counts a failed attempt on a record and answers how many there were. */
  async countFailure(kind: string, secret: string, ttlSeconds: number): Promise<number> {
    const key = `${keyOf(kind, secret)}:failures`;
    const failures = await this.redis.incr(key);
    if (failures === 1) await this.redis.expire(key, ttlSeconds);
    return failures;
  }

  async onModuleDestroy(): Promise<void> {
    if (this.redis.status === 'wait') {
      this.redis.disconnect();
      return;
    }
    await this.redis.quit().catch(() => undefined);
  }
}
