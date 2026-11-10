vi.mock('franc', () => ({
  franc: () => 'und',
}));

import { type INestApplication, ValidationPipe } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import { Queue, Worker } from 'bullmq';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { User, UserRole } from '../../src/entities/user.entity';
import { HealthRedisService } from '../../src/modules/system-health/health-redis.service';
import { WORKER_STALE_MS } from '../../src/modules/system-health/health-verdicts';
import { becameDueAt } from '../../src/modules/system-health/queue-latency';
import { SystemHealthService } from '../../src/modules/system-health/system-health.service';
import { WorkerHeartbeatService } from '../../src/modules/system-health/worker-heartbeat.service';
import {
  deleteUserByEmail,
  type E2eAccount,
  e2eTestingModule,
  registerAccount,
} from './helpers/e2e-app';

/**
 * Readiness is public and coarse (database and Redis, ok or not); the instance
 * admin gets every check in detail, and nobody else gets any of it.
 */
describe('System health (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  const stamp = Date.now();
  const emails = { admin: `sh-admin-${stamp}@example.com`, member: `sh-member-${stamp}@example.com` };
  let admin: E2eAccount;
  let member: E2eAccount;
  const env = { ...process.env };

  const as = (account: E2eAccount, req: request.Test) =>
    req.set('Authorization', `Bearer ${account.token}`).set('x-workspace-id', account.workspaceId);
  const health = (account: E2eAccount, query = '') =>
    as(account, request(app.getHttpServer()).get(`/system/health${query}`));

  beforeAll(async () => {
    const moduleFixture: TestingModule = await e2eTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    dataSource = moduleFixture.get<DataSource>(DataSource);
    // The test writes heartbeats itself; the timer must not overwrite them.
    app.get(WorkerHeartbeatService).onModuleDestroy();

    admin = await registerAccount(app, emails.admin, 'Health Admin');
    member = await registerAccount(app, emails.member, 'Health Member');
    await dataSource.getRepository(User).update({ email: emails.admin }, { role: UserRole.ADMIN });
    await dataSource.getRepository(User).update({ email: emails.member }, { role: UserRole.USER });
  });

  afterEach(() => {
    process.env = { ...env };
  });

  afterAll(async () => {
    if (dataSource) {
      for (const email of Object.values(emails)) {
        await deleteUserByEmail(dataSource, email);
      }
    }
    await app.close();
  });

  it('public readiness names the database and Redis, and nothing else', async () => {
    const res = await request(app.getHttpServer()).get('/health/ready').expect(200);
    expect(res.body).toEqual({ status: 'ok', checks: { db: 'ok', redis: 'ok' } });
    for (const detail of ['statement-parsing', 'smtp', 'backups', 'workerSeenAt', 'waiting']) {
      expect(res.text).not.toContain(detail);
    }
  });

  it('gives the instance admin every service, queue and setup check', async () => {
    await app.get(WorkerHeartbeatService).beat();
    const res = await health(admin).expect(200);

    expect(res.body.services).toEqual([
      expect.objectContaining({ key: 'database', level: 'ok' }),
      expect.objectContaining({ key: 'redis', level: 'ok' }),
    ]);
    const names = res.body.queues.map((queue: { name: string }) => queue.name);
    expect(names).toEqual(
      expect.arrayContaining(['custom-table-recalc', 'ledger-sync', 'statement-parsing']),
    );
    for (const queue of res.body.queues) {
      expect(queue).toMatchObject({ level: 'ok', reason: 'ok' });
      expect(queue.workerSeenAt).toEqual(expect.any(String));
      expect(queue.waiting).toEqual(expect.any(Number));
    }
    expect(res.body.config.map((check: { key: string }) => check.key)).toEqual([
      'smtp',
      'push',
      'backups',
      'app_url',
      'encryption_key',
    ]);
  });

  it('names a worker whose heartbeat stopped, and since when', async () => {
    const lastSeen = new Date(Date.now() - WORKER_STALE_MS - 60_000);
    await app.get(HealthRedisService).recordWorkerHeartbeat('statement-parsing', lastSeen);
    try {
      const res = await health(admin).expect(200);
      const parsing = res.body.queues.find(
        (queue: { name: string }) => queue.name === 'statement-parsing',
      );
      expect(parsing).toMatchObject({
        level: 'error',
        reason: 'worker_stale',
        workerSeenAt: lastSeen.toISOString(),
      });
      expect(res.body.level).toBe('error');
    } finally {
      await app.get(WorkerHeartbeatService).beat();
    }
  });

  it("reports the server's last failed mail and a public address the admin did not open", async () => {
    process.env.SMTP_HOST = 'smtp.example.co.il';
    process.env.SMTP_FROM = 'budget@example.co.il';
    process.env.SMTP_PASS = `smtp-pass-${stamp}`;
    process.env.APP_URL = 'https://budget.example.co.il';
    const failedAt = new Date(Date.now() - 60_000);
    await app.get(HealthRedisService).recordSmtpSend(false, failedAt);

    const res = await health(admin, `?origin=${encodeURIComponent('http://10.0.0.5:3000')}`).expect(200);

    const byKey = Object.fromEntries(
      res.body.config.map((check: { key: string }) => [check.key, check]),
    );
    expect(byKey.smtp).toMatchObject({
      level: 'error',
      reason: 'last_send_failed',
      since: failedAt.toISOString(),
    });
    expect(byKey.app_url).toMatchObject({
      level: 'warning',
      reason: 'mismatch',
      url: 'https://budget.example.co.il',
    });
    expect(res.text).not.toContain(`smtp-pass-${stamp}`);
  });

  describe('queue latency counts from when a job became due', () => {
    const connection = { url: process.env.REDIS_URL || 'redis://localhost:6379' };
    const name = `zz-health-latency-${stamp}`;
    let queue: Queue;
    let worker: Worker;
    const fortyMinutesAgo = () => Date.now() - 40 * 60_000;
    const oldestWaitingSeconds = async () => {
      const service = new SystemHealthService(dataSource, app.get(HealthRedisService), {
        queues: () => [queue],
      } as unknown as WorkerHeartbeatService);
      const details = await service.details(null);
      return details.queues[0].oldestWaitingSeconds;
    };

    beforeEach(async () => {
      queue = new Queue(name, { connection });
      // No processor: jobs are taken by hand, so nothing else moves them.
      worker = new Worker(name, null, { connection, autorun: false });
    });

    afterEach(async () => {
      await worker.close();
      await queue.obliterate({ force: true });
      await queue.close();
    });

    it('a delayed job waits from when its delay ran out, not from when it was added', async () => {
      // BullMQ resets `delay` to 0 on promotion: created plus delay would read 40 minutes.
      const job = await queue.add('x', {}, { timestamp: fortyMinutesAgo(), delay: 39 * 60_000 });
      await job.promote();
      expect(await oldestWaitingSeconds()).toBeLessThan(60);
    });

    it('a retried job waits from its retry, not from its first attempt', async () => {
      await queue.add('x', {}, { timestamp: fortyMinutesAgo(), attempts: 2 });
      const token = `zz-token-${stamp}`;
      const taken = await worker.getNextJob(token);
      if (!taken) throw new Error('no job to take');
      await taken.moveToFailed(new Error('first attempt failed'), token);
      expect(await queue.getJobCounts('waiting')).toEqual({ waiting: 1 });
      expect(await oldestWaitingSeconds()).toBeLessThan(60);
    });

    it('a job whose entry was trimmed from the events stream falls back to its own fields', async () => {
      const job = await queue.add('x', {}, { timestamp: fortyMinutesAgo() });
      const client = await queue.getBackend().client;
      await client.xtrim(queue.keys.events, 'MAXLEN', 0);
      expect((await becameDueAt(app.get(HealthRedisService), queue, job)).getTime()).toBe(job.timestamp);
      const seconds = await oldestWaitingSeconds();
      expect(seconds).toBeGreaterThanOrEqual(40 * 60 - 5);
    });
  });

  it('refuses a member who is not the instance admin', async () => {
    await health(member).expect(403);
  });

  it('refuses anyone signed out', async () => {
    await request(app.getHttpServer()).get('/system/health').expect(401);
  });
});
