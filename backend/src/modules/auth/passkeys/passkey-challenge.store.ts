import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

/** How long a challenge can be answered. */
export const PASSKEY_CHALLENGE_TTL_MS = 5 * 60 * 1000;

/**
 * What a challenge was issued for: adding a passkey and the second factor are
 * bound to the signed-in or password-checked user, a sign-in without an e-mail
 * to the browser that asked (a hash of its flow cookie).
 */
export type PasskeyFlow = 'register' | 'second-factor' | 'sign-in';

/**
 * WebAuthn challenges, kept in Redis so every API instance sees them. One key per
 * flow and subject, so a challenge only works in the flow and for the user (or
 * browser) it was issued to; `GETDEL` hands it out once, so it cannot be replayed,
 * and it expires after five minutes.
 */
@Injectable()
export class PasskeyChallengeStore implements OnModuleDestroy {
  private readonly redis: Redis;

  constructor(configService: ConfigService) {
    this.redis = new Redis(configService.get<string>('REDIS_URL') || 'redis://localhost:6379', {
      lazyConnect: true,
      maxRetriesPerRequest: 2,
    });
  }

  async issue(flow: PasskeyFlow, subject: string, challenge: string): Promise<void> {
    await this.redis.set(this.key(flow, subject), challenge, 'PX', PASSKEY_CHALLENGE_TTL_MS);
  }

  /** The challenge issued for this flow and subject, removed as it is read; null when none is live. */
  async consume(flow: PasskeyFlow, subject: string): Promise<string | null> {
    return this.redis.getdel(this.key(flow, subject));
  }

  onModuleDestroy(): void {
    this.redis.disconnect();
  }

  private key(flow: PasskeyFlow, subject: string): string {
    return `passkey:challenge:${flow}:${subject}`;
  }
}
