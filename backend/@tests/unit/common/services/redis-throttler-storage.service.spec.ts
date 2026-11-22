import { type AddressInfo, createServer, type Server, type Socket } from 'node:net';
import { Logger } from '@nestjs/common';
import { ThrottlerStorageService } from '@nestjs/throttler';
import type { Mock } from 'vitest';
import type Redis from 'ioredis';
import {
  RedisThrottlerStorage,
  THROTTLER_REDIS_TIMEOUT_MS,
} from '@/common/services/redis-throttler-storage.service';

afterEach(() => {
  vi.restoreAllMocks();
});

const fakeRedis = (result: unknown) => {
  const redis = { eval: vi.fn().mockResolvedValue(result), disconnect: vi.fn() };
  return redis as unknown as Redis & { eval: Mock; disconnect: Mock };
};

describe('RedisThrottlerStorage', () => {
  it('keeps both keys of one throttler under one hash tag', async () => {
    const redis = fakeRedis([1, 60000, 0, 0]);

    await new RedisThrottlerStorage(redis).increment('ip-key', 60000, 5, 60000, 'default');

    const [, keyCount, hitKey, blockKey, ttl, limit, blockDuration] = redis.eval.mock.calls[0];
    expect(keyCount).toBe(2);
    expect(hitKey).toBe('{ip-key:default}:hits');
    expect(blockKey).toBe('{ip-key:default}:blocked');
    expect([ttl, limit, blockDuration]).toEqual([60000, 5, 60000]);
  });

  it('answers in seconds, rounding the milliseconds Redis gives up', async () => {
    const redis = fakeRedis([6, 1500, 1, 30001]);

    const record = await new RedisThrottlerStorage(redis).increment('k', 60000, 5, 60000, 't');

    expect(record).toEqual({
      totalHits: 6,
      timeToExpire: 2,
      isBlocked: true,
      timeToBlockExpire: 31,
    });
  });

  it('refuses a script result it does not understand', async () => {
    const storage = new RedisThrottlerStorage(fakeRedis(['1', 60000, 0, 0]));

    await expect(storage.increment('k', 60000, 5, 60000, 't')).rejects.toThrow(TypeError);
  });

  it('leaves a connection it was handed open on shutdown', () => {
    const redis = fakeRedis([1, 1, 0, 0]);

    new RedisThrottlerStorage(redis).onModuleDestroy();

    expect(redis.disconnect).not.toHaveBeenCalled();
  });

  describe('while Redis does not answer', () => {
    const failingRedis = () => {
      const redis = fakeRedis(null);
      redis.eval.mockRejectedValue(new Error('Connection is closed.'));
      return redis;
    };

    it('still enforces the limit, counted in this process', async () => {
      const storage = new RedisThrottlerStorage(failingRedis());

      const hits = [];
      for (let i = 0; i < 3; i++) {
        hits.push(await storage.increment('ip-key', 60_000, 2, 60_000, 'login'));
      }

      expect(hits.map(h => h.totalHits)).toEqual([1, 2, 3]);
      expect(hits.map(h => h.isBlocked)).toEqual([false, false, true]);
      storage.onModuleDestroy();
    });

    it('warns once when it starts counting locally and notes when Redis is back', async () => {
      const redis = failingRedis();
      const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
      const log = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
      const storage = new RedisThrottlerStorage(redis);

      await storage.increment('k', 60_000, 5, 60_000, 't');
      await storage.increment('k', 60_000, 5, 60_000, 't');
      redis.eval.mockResolvedValue([1, 60_000, 0, 0]);
      const back = await storage.increment('k', 60_000, 5, 60_000, 't');

      expect(warn).toHaveBeenCalledTimes(1);
      expect(log).toHaveBeenCalledTimes(1);
      expect(back.totalHits).toBe(1);
      storage.onModuleDestroy();
    });

    it('stops the local counters on shutdown', () => {
      const fallback = new ThrottlerStorageService();
      const shutdown = vi.spyOn(fallback, 'onApplicationShutdown');

      new RedisThrottlerStorage(failingRedis(), fallback).onModuleDestroy();

      expect(shutdown).toHaveBeenCalledTimes(1);
    });
  });

  describe('its own connection', () => {
    let server: Server;
    let port: number;
    const sockets = new Set<Socket>();

    let answerHandshake = false;

    // A Redis that accepts the connection and never answers. With
    // answerHandshake it answers ioredis's handshake (HELLO refused, so RESP2;
    // CLIENT SETINFO; the INFO of the ready check), so the connection is ready,
    // and then never answers EVAL.
    const reply = (command: string) => {
      if (command === 'hello') return "-ERR unknown command 'hello'\r\n";
      if (command === 'info') return '$11\r\nloading:0\r\n\r\n';
      if (command === 'eval' || command === 'evalsha') return '';
      return '+OK\r\n';
    };

    beforeAll(async () => {
      server = createServer(socket => {
        sockets.add(socket);
        socket.on('close', () => sockets.delete(socket));
        socket.on('data', chunk => {
          if (!answerHandshake) return;
          for (const [, name] of chunk.toString().matchAll(/\*\d+\r\n\$\d+\r\n([A-Za-z]+)\r\n/g)) {
            socket.write(reply(name.toLowerCase()));
          }
        });
      });
      await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
      port = (server.address() as AddressInfo).port;
    });

    afterAll(async () => {
      for (const socket of sockets) socket.destroy();
      await new Promise(resolve => server.close(resolve));
    });

    it('answers at once from local counters instead of waiting on a silent Redis', async () => {
      vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
      const storage = new RedisThrottlerStorage(`redis://127.0.0.1:${port}`);
      await new Promise(resolve => setTimeout(resolve, 50));

      const started = Date.now();
      const record = await storage.increment('k', 60_000, 5, 60_000, 't');

      expect(record.totalHits).toBe(1);
      expect(Date.now() - started).toBeLessThan(THROTTLER_REDIS_TIMEOUT_MS + 250);
      storage.onModuleDestroy();
    });

    it('gives up on a command a connected Redis never answers', async () => {
      vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
      answerHandshake = true;
      const storage = new RedisThrottlerStorage(`redis://127.0.0.1:${port}`);
      await new Promise(resolve => setTimeout(resolve, 100));
      // The handshake went through: the stand-in counts as a ready Redis.
      expect((storage as unknown as { redis: Redis }).redis.status).toBe('ready');

      const started = Date.now();
      const record = await storage.increment('k', 60_000, 5, 60_000, 't');

      expect(record.totalHits).toBe(1);
      expect(Date.now() - started).toBeLessThan(THROTTLER_REDIS_TIMEOUT_MS + 250);
      storage.onModuleDestroy();
      answerHandshake = false;
    });
  });
});
