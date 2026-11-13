vi.mock('franc', () => ({
  franc: () => 'und',
}));

import { randomUUID } from 'node:crypto';
import { type INestApplication, ValidationPipe } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import {
  type BankSyncClaim,
  BankSyncClaimsService,
} from '../../src/modules/bank-sync/bank-sync-claims.service';
import { BANK_SYNC_FETCH } from '../../src/modules/bank-sync/bank-sync-provider.interface';
import { BankSyncSchedulerService } from '../../src/modules/bank-sync/bank-sync-scheduler.service';
import {
  deleteUserByEmail,
  type E2eAccount,
  e2eTestingModule,
  registerAccount,
} from './helpers/e2e-app';

const HOUR_MS = 3600_000;
const PROVIDERS = ['simplefin', 'enablebanking'];

/**
 * A stand-in SimpleFIN Bridge whose answer each test sets: every setup token
 * claims once, and every listing answers `bridge.reply()`.
 */
const bridge = {
  calls: 0,
  reply: (): Response => listing(),
};

function listing(): Response {
  return new Response(
    JSON.stringify({
      errors: [],
      accounts: [
        {
          org: { name: 'Demo Bank' },
          id: 'ACT-1',
          name: 'Checking',
          currency: 'USD',
          balance: '100.00',
          'balance-date': Math.floor(Date.now() / 1000),
          transactions: [],
        },
      ],
    }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  );
}

async function standIn(url: string, init: RequestInit = {}): Promise<Response> {
  if (url.startsWith('https://bridge.example.org/claim/') && init.method === 'POST') {
    return new Response(`https://demo:${url.split('/').pop()}@bridge.example.org/simplefin`, {
      status: 200,
    });
  }
  if (url.startsWith('https://bridge.example.org/simplefin/accounts')) {
    bridge.calls += 1;
    return bridge.reply();
  }
  return new Response('', { status: 404 });
}

describe('Bank sync schedule (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let claims: BankSyncClaimsService;
  let scheduler: BankSyncSchedulerService;
  const stamp = Date.now();
  const emails = {
    owner: `schedule-owner-${stamp}@example.com`,
    other: `schedule-other-${stamp}@example.com`,
  };
  let owner: E2eAccount;
  let other: E2eAccount;

  const as = (account: E2eAccount, req: request.Test) =>
    req.set('Authorization', `Bearer ${account.token}`).set('x-workspace-id', account.workspaceId);
  const server = () => app.getHttpServer();
  const base = (id: string) => `/integrations/bank-sync/connections/${id}`;

  const connect = async (account: E2eAccount = owner): Promise<string> => {
    const token = Buffer.from(`https://bridge.example.org/claim/${randomUUID()}`).toString('base64');
    const res = await as(account, request(server()).post('/integrations/bank-sync/connections/token'))
      .send({ provider: 'simplefin', setupToken: token, label: 'Bridge' })
      .expect(201);
    // Connecting lists the accounts once; the tests count pulls.
    bridge.calls = 0;
    return res.body.id;
  };

  const scheduleOf = async (id: string) => {
    const res = await as(owner, request(server()).get('/integrations/bank-sync/connections')).expect(
      200,
    );
    return res.body.find((item: { id: string }) => item.id === id).schedule;
  };

  /** Lets the next manual pull through the cooldown, as if a minute had passed. */
  const coolDown = (id: string) =>
    dataSource.query(
      `UPDATE open_protocol_settings SET last_pull_attempt_at = now() - interval '5 minutes'
       WHERE integration_id = $1`,
      [id],
    );

  const makeDue = (ids: string[]) =>
    dataSource.query(
      `UPDATE open_protocol_settings
       SET next_pull_at = now() - interval '1 minute', pull_lease_until = NULL
       WHERE integration_id = ANY($1::uuid[])`,
      [ids],
    );

  /** Claims everything due, keeping only the connections this test made. */
  const claimMine = async (mine: string[]): Promise<BankSyncClaim[]> =>
    (await claims.claimDue(PROVIDERS, 100)).filter(claim => mine.includes(claim.connectionId));

  /** Nothing outside a test stays due between tests, so a claim sees only what the test set up. */
  const parkAll = () =>
    dataSource.query(`UPDATE open_protocol_settings SET next_pull_at = now() + interval '1 day'`);

  beforeAll(async () => {
    const moduleFixture: TestingModule = await e2eTestingModule({ imports: [AppModule] })
      .overrideProvider(BANK_SYNC_FETCH)
      .useValue(standIn)
      .compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    dataSource = moduleFixture.get(DataSource);
    claims = moduleFixture.get(BankSyncClaimsService);
    scheduler = moduleFixture.get(BankSyncSchedulerService);
    owner = await registerAccount(app, emails.owner, 'Member One');
    other = await registerAccount(app, emails.other, 'Member Two');
  }, 180_000);

  beforeEach(async () => {
    bridge.reply = () => listing();
    bridge.calls = 0;
    await parkAll();
  });

  afterAll(async () => {
    if (dataSource) {
      for (const email of Object.values(emails)) await deleteUserByEmail(dataSource, email);
    }
    await app.close();
  });

  describe('frequency', () => {
    it('starts every connection at six hours and lets the owner pick 1 to 24', async () => {
      const id = await connect();
      expect((await scheduleOf(id)).intervalHours).toBe(6);

      const res = await as(owner, request(server()).patch(base(id)))
        .send({ syncIntervalHours: 2 })
        .expect(200);
      expect(res.body.schedule).toMatchObject({ intervalHours: 2, consecutiveFailures: 0 });
      // Never pulled: due at the next check, not two hours from now.
      expect(new Date(res.body.schedule.nextPullAt).getTime()).toBeLessThanOrEqual(Date.now());

      for (const syncIntervalHours of [0, 25, 1.5, -1]) {
        await as(owner, request(server()).patch(base(id)))
          .send({ syncIntervalHours })
          .expect(400);
      }
      expect((await scheduleOf(id)).intervalHours).toBe(2);
    });

    it('moves the due time to one new interval after the last good pull', async () => {
      const id = await connect();
      await as(owner, request(server()).post(`${base(id)}/sync`)).expect(201);
      const res = await as(owner, request(server()).patch(base(id)))
        .send({ syncIntervalHours: 12 })
        .expect(200);
      const due = new Date(res.body.schedule.nextPullAt).getTime();
      expect(due).toBeGreaterThan(Date.now() + 11 * HOUR_MS);
      expect(due).toBeLessThanOrEqual(Date.now() + 12 * HOUR_MS);
    });

    it('is not found from another workspace, and leaves the connection as it was', async () => {
      const id = await connect();
      await as(other, request(server()).patch(base(id)))
        .send({ syncIntervalHours: 1 })
        .expect(404);
      await as(other, request(server()).post(`${base(id)}/sync`)).expect(404);
      expect((await scheduleOf(id)).intervalHours).toBe(6);
      expect(bridge.calls).toBe(0);
    });

    it('survives a pull saving its settings while the interval changes', async () => {
      const id = await connect();
      // A pull loads the settings row, the user changes the interval, the pull saves.
      const [settings] = await dataSource.query(
        'SELECT id FROM open_protocol_settings WHERE integration_id = $1',
        [id],
      );
      const repository = dataSource.getRepository('OpenProtocolSettings');
      const loaded = await repository.findOneByOrFail({ id: settings.id });
      await as(owner, request(server()).patch(base(id))).send({ syncIntervalHours: 3 }).expect(200);
      await repository.save({ ...loaded, config: { ...loaded.config, label: 'Renamed' } });
      expect((await scheduleOf(id)).intervalHours).toBe(3);
    });
  });

  describe('sync now', () => {
    it('refuses a second pull within the cooldown, and a double-click pulls once', async () => {
      const id = await connect();
      const [first, second] = await Promise.all([
        as(owner, request(server()).post(`${base(id)}/sync`)),
        as(owner, request(server()).post(`${base(id)}/sync`)),
      ]);
      expect([first.status, second.status].sort()).toEqual([201, 429]);
      const refused = first.status === 429 ? first : second;
      expect(refused.body.error.code).toBe('BANK_SYNC_TOO_SOON');
      expect(bridge.calls).toBe(1);

      await as(owner, request(server()).post(`${base(id)}/sync`)).expect(429);
      await coolDown(id);
      await as(owner, request(server()).post(`${base(id)}/sync`)).expect(201);
    });

    it('is refused while an automatic pull holds the connection', async () => {
      const id = await connect();
      await makeDue([id]);
      expect((await claimMine([id])).map(claim => claim.connectionId)).toEqual([id]);
      await coolDown(id);
      const res = await as(owner, request(server()).post(`${base(id)}/sync`)).expect(429);
      expect(res.body.error.params).toEqual({ seconds: 60 });
    });
  });

  describe('failures', () => {
    it('keeps a provider’s 429 Retry-After, skips the connection until then, and a manual pull resets it', async () => {
      const id = await connect();
      bridge.reply = () => new Response('', { status: 429, headers: { 'retry-after': '7200' } });

      const res = await as(owner, request(server()).post(`${base(id)}/sync`)).expect(503);
      expect(res.headers['retry-after']).toBe('7200');
      expect(bridge.calls).toBe(1);

      const schedule = await scheduleOf(id);
      expect(schedule.consecutiveFailures).toBe(1);
      expect(schedule.backoffReason).toBe('provider_busy');
      const until = new Date(schedule.backoffUntil).getTime();
      expect(until).toBeGreaterThan(Date.now() + 1.9 * HOUR_MS);
      expect(until).toBeLessThanOrEqual(Date.now() + 2 * HOUR_MS + 60_000);
      expect(schedule.nextPullAt).toBe(schedule.backoffUntil);

      // The automatic pull leaves it alone until then.
      expect(await claimMine([id])).toEqual([]);

      bridge.reply = () => listing();
      await coolDown(id);
      await as(owner, request(server()).post(`${base(id)}/sync`)).expect(201);
      expect(await scheduleOf(id)).toMatchObject({
        consecutiveFailures: 0,
        backoffUntil: null,
        backoffReason: null,
      });
    });

    it('keeps a provider’s Retry-After when the interval changes during the backoff', async () => {
      const id = await connect();
      bridge.reply = () => new Response('', { status: 429, headers: { 'retry-after': '7200' } });
      await as(owner, request(server()).post(`${base(id)}/sync`)).expect(503);
      const before = await scheduleOf(id);

      const res = await as(owner, request(server()).patch(base(id)))
        .send({ syncIntervalHours: 1 })
        .expect(200);
      // Never pulled well, so a new interval alone would make it due at once.
      expect(res.body.schedule).toMatchObject({
        intervalHours: 1,
        nextPullAt: before.backoffUntil,
        backoffUntil: before.backoffUntil,
      });
      expect(await claimMine([id])).toEqual([]);
    });

    it('backs off longer after each automatic failure in a row', async () => {
      const id = await connect();
      bridge.reply = () => new Response('', { status: 400 });
      const waits: number[] = [];
      for (let round = 0; round < 3; round += 1) {
        await makeDue([id]);
        await scheduler.tick();
        const schedule = await scheduleOf(id);
        expect(schedule.consecutiveFailures).toBe(round + 1);
        waits.push(new Date(schedule.backoffUntil).getTime() - Date.now());
      }
      expect(waits[0]).toBeGreaterThan(0.45 * HOUR_MS);
      expect(waits[1]).toBeGreaterThan(waits[0]);
      expect(waits[2]).toBeGreaterThan(waits[1]);

      bridge.reply = () => listing();
      await makeDue([id]);
      await scheduler.tick();
      const recovered = await scheduleOf(id);
      expect(recovered).toMatchObject({ consecutiveFailures: 0, backoffUntil: null });
      const next = new Date(recovered.nextPullAt).getTime();
      expect(next).toBeGreaterThan(Date.now() + 5 * HOUR_MS);
      expect(next).toBeLessThanOrEqual(Date.now() + 6.6 * HOUR_MS);
    });

    it('stops pulling a connection whose credential was refused', async () => {
      const id = await connect();
      bridge.reply = () => new Response('', { status: 401 });
      await makeDue([id]);
      await scheduler.tick();
      expect(bridge.calls).toBe(1);

      const list = await as(owner, request(server()).get('/integrations/bank-sync/connections'));
      const connection = list.body.find((item: { id: string }) => item.id === id);
      expect(connection.status).toBe('needs_reauth');
      expect(connection.schedule).toMatchObject({ consecutiveFailures: 1, backoffUntil: null });

      await makeDue([id]);
      await scheduler.tick();
      expect(bridge.calls).toBe(1);
    });
  });

  describe('claiming due connections', () => {
    it('claims only what is due, connected, auto-synced, unleased and in an ordinary workspace', async () => {
      const [due, autoOff, leased, notDue, reauth, disconnected, inVersion] = await Promise.all(
        Array.from({ length: 7 }, () => connect()),
      );
      await makeDue([due, autoOff, leased, reauth, disconnected, inVersion]);
      await dataSource.query(
        `UPDATE open_protocol_settings SET next_pull_at = now() + interval '1 hour'
         WHERE integration_id = $1`,
        [notDue],
      );
      await as(owner, request(server()).patch(base(autoOff))).send({ autoSync: false }).expect(200);
      await dataSource.query(
        `UPDATE open_protocol_settings SET pull_lease_until = now() + interval '10 minutes'
         WHERE integration_id = $1`,
        [leased],
      );
      await dataSource.query(`UPDATE integrations SET status = 'needs_reauth' WHERE id = $1`, [
        reauth,
      ]);
      await as(owner, request(server()).delete(base(disconnected))).expect(200);
      const [version] = await dataSource.query(
        `INSERT INTO workspaces (name, currency, owner_id, kind)
         VALUES ('Books on 1 Oct', 'USD', $1, 'version') RETURNING id`,
        [owner.userId],
      );
      await dataSource.query('UPDATE integrations SET workspace_id = $2 WHERE id = $1', [
        inVersion,
        version.id,
      ]);

      const mine = [due, autoOff, leased, notDue, reauth, disconnected, inVersion];
      const claimed = await claimMine(mine);
      const names = new Map(
        Object.entries({ due, autoOff, leased, notDue, reauth, disconnected, inVersion }).map(
          ([name, id]) => [id, name],
        ),
      );
      expect(claimed.map(claim => names.get(claim.connectionId))).toEqual(['due']);
      expect(claimed[0]).toMatchObject({ workspaceId: owner.workspaceId, userId: owner.userId });

      // Claimed means leased: the next tick does not take it again.
      expect(await claimMine(mine)).toEqual([]);
    });

    it('takes over a lease a crashed pull left behind', async () => {
      const id = await connect();
      await dataSource.query(
        `UPDATE open_protocol_settings
         SET next_pull_at = now() - interval '1 hour', pull_lease_until = now() - interval '1 minute'
         WHERE integration_id = $1`,
        [id],
      );
      expect((await claimMine([id])).map(claim => claim.connectionId)).toEqual([id]);
    });

    it('drops the outcome of a pull that outlived its lease, keeping the lease of the one that took over', async () => {
      const id = await connect();
      await makeDue([id]);
      const [stale] = await claimMine([id]);
      await dataSource.query(
        `UPDATE open_protocol_settings SET pull_lease_until = now() - interval '1 minute'
         WHERE integration_id = $1`,
        [id],
      );
      const [current] = await claimMine([id]);
      expect(current.leaseUntil.getTime()).toBeGreaterThan(Date.now());

      const leaseOf = async () =>
        (
          await dataSource.query(
            'SELECT pull_lease_until AS "lease" FROM open_protocol_settings WHERE integration_id = $1',
            [id],
          )
        )[0].lease as Date | null;
      await claims.recordSuccess(stale);
      await claims.recordFailure(stale, new Error('late'));
      expect((await leaseOf())?.getTime()).toBe(current.leaseUntil.getTime());
      expect((await scheduleOf(id)).consecutiveFailures).toBe(0);
      await coolDown(id);
      await as(owner, request(server()).post(`${base(id)}/sync`)).expect(429);

      // The pull that holds it records as usual.
      await claims.recordSuccess(current);
      expect(await leaseOf()).toBeNull();
    });

    it('never hands one connection to two concurrent claims', async () => {
      const mine = [
        ...(await Promise.all(Array.from({ length: 6 }, () => connect()))),
        ...(await Promise.all(Array.from({ length: 6 }, () => connect(other)))),
      ];
      for (let round = 0; round < 5; round += 1) {
        await makeDue(mine);
        const batches = await Promise.all(
          Array.from({ length: 4 }, () => claims.claimDue(PROVIDERS, 4)),
        );
        const ids = batches.flat().map(claim => claim.connectionId);
        expect(new Set(ids).size).toBe(ids.length);

        // Whatever a claim skipped as locked is still there for the next one, exactly once.
        const rest = (await claims.claimDue(PROVIDERS, 100)).map(claim => claim.connectionId);
        expect([...ids, ...rest].filter(id => mine.includes(id)).sort()).toEqual([...mine].sort());
      }
    });
  });
});
