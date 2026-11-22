import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

const keyOf = (jti: string): string => `mcp:confirm:used:${jti}`;

/**
 * Confirm tokens already spent, in Redis until they would have expired anyway.
 * Shared by every API instance, so a token works once whichever one takes it.
 */
@Injectable()
export class ConfirmReplayStore implements OnModuleDestroy {
  private connection: Redis | null = null;

  constructor(private readonly config: ConfigService) {}

  async isUsed(jti: string): Promise<boolean> {
    return (await this.redis().exists(keyOf(jti))) === 1;
  }

  /** True for the first claim of `jti`, false for every later one. */
  async claim(jti: string, ttlMs: number): Promise<boolean> {
    return (await this.redis().set(keyOf(jti), '1', 'PX', ttlMs, 'NX')) === 'OK';
  }

  async onModuleDestroy(): Promise<void> {
    await this.connection?.quit();
  }

  // Opened on first use: most MCP calls never confirm anything.
  private redis(): Redis {
    this.connection ??= new Redis(
      this.config.get<string>('REDIS_URL') || 'redis://localhost:6379',
      { maxRetriesPerRequest: 2 },
    );
    return this.connection;
  }
}
