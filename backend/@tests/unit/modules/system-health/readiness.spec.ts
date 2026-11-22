import { type AddressInfo, createServer, type Server, type Socket } from 'node:net';
import { AppService } from '@/app.service';
import { HealthRedisService, REDIS_PING_TIMEOUT_MS } from '@/modules/system-health/health-redis.service';
import type { SystemHealthService } from '@/modules/system-health/system-health.service';

const appWith = (db: boolean, redis: boolean) =>
  new AppService({
    pingDatabase: async () => db,
    pingRedis: async () => redis,
  } as unknown as SystemHealthService);

describe('readiness', () => {
  it('is ready only when the database and Redis both answer', async () => {
    await expect(appWith(true, true).getReadiness()).resolves.toEqual({
      status: 'ok',
      checks: { db: 'ok', redis: 'ok' },
    });
    await expect(appWith(true, false).getReadiness()).resolves.toEqual({
      status: 'error',
      checks: { db: 'ok', redis: 'error' },
    });
  });
});

describe('HealthRedisService against a Redis that is not there', () => {
  const original = process.env.REDIS_URL;
  let service: HealthRedisService;
  beforeAll(() => {
    // Port 1 on loopback: nothing listens, the connection is refused.
    process.env.REDIS_URL = 'redis://127.0.0.1:1';
    service = new HealthRedisService();
  });
  afterAll(async () => {
    await service.onModuleDestroy();
    process.env.REDIS_URL = original;
  });

  it('answers "down" within the ping timeout', async () => {
    const started = Date.now();
    await expect(service.ping()).resolves.toBe(false);
    expect(Date.now() - started).toBeLessThanOrEqual(REDIS_PING_TIMEOUT_MS + 200);
  });

  it('does not let a mail fail because the signal cannot be written', async () => {
    await expect(service.recordSmtpSend(true)).resolves.toBeUndefined();
  });
});

describe('HealthRedisService against a Redis that takes the connection and never answers', () => {
  const original = process.env.REDIS_URL;
  const sockets = new Set<Socket>();
  let server: Server;
  let service: HealthRedisService;
  beforeAll(async () => {
    server = createServer(socket => {
      // Accept and stay silent: the client never gets past its ready check.
      sockets.add(socket);
      socket.on('close', () => sockets.delete(socket));
    });
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    process.env.REDIS_URL = `redis://127.0.0.1:${(server.address() as AddressInfo).port}`;
    service = new HealthRedisService();
  });
  afterAll(async () => {
    await service.onModuleDestroy();
    for (const socket of sockets) socket.destroy();
    await new Promise(resolve => server.close(resolve));
    process.env.REDIS_URL = original;
  });

  it('fails the ping at once instead of queueing it until the connection is ready', async () => {
    const started = Date.now();
    await expect(service.ping()).resolves.toBe(false);
    // With the offline queue on, the ping would wait for "ready" until the timeout.
    expect(Date.now() - started).toBeLessThan(REDIS_PING_TIMEOUT_MS / 2);
  });
});
