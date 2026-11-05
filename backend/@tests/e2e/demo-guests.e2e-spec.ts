import { type INestApplication, ValidationPipe } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { GUEST_EMAIL_DOMAIN } from '../../src/modules/auth/demo-guests/demo-guests.config';
import { DemoGuestsService } from '../../src/modules/auth/demo-guests/demo-guests.service';
import { accessTokenOf, e2eTestingModule } from './helpers/e2e-app';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * `POST /auth/demo`: a visitor of a public demo instance gets a guest account
 * whose home workspace is a filled demo, signed in by cookie. Off by default,
 * capped at DEMO_GUESTS_MAX, and swept away with its data after the TTL.
 */
describe('Demo guests (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let guests: DemoGuestsService;
  const saved = {
    enabled: process.env.DEMO_GUESTS_ENABLED,
    max: process.env.DEMO_GUESTS_MAX,
    ttl: process.env.DEMO_GUEST_TTL_HOURS,
  };

  const createGuest = () => request(app.getHttpServer()).post('/auth/demo');
  const guestCount = async () =>
    Number(
      (
        await dataSource.query('SELECT count(*) AS n FROM users WHERE email LIKE $1', [
          `%@${GUEST_EMAIL_DOMAIN}`,
        ])
      )[0].n,
    );

  const restore = (key: string, value: string | undefined) => {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await e2eTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    dataSource = moduleFixture.get<DataSource>(DataSource);
    guests = moduleFixture.get(DemoGuestsService);
  });

  beforeEach(async () => {
    process.env.DEMO_GUESTS_ENABLED = 'true';
    delete process.env.DEMO_GUESTS_MAX;
    delete process.env.DEMO_GUEST_TTL_HOURS;
    // Everything a test made, swept by the service under test itself.
    await guests.removeExpired(new Date(Date.now() + 365 * DAY_MS));
  });

  afterAll(async () => {
    process.env.DEMO_GUESTS_ENABLED = 'true';
    if (guests) await guests.removeExpired(new Date(Date.now() + 365 * DAY_MS));
    restore('DEMO_GUESTS_ENABLED', saved.enabled);
    restore('DEMO_GUESTS_MAX', saved.max);
    restore('DEMO_GUEST_TTL_HOURS', saved.ttl);
    await app.close();
  });

  it('is not there unless the instance turns it on', async () => {
    delete process.env.DEMO_GUESTS_ENABLED;
    await createGuest().expect(404);
    expect(await guestCount()).toBe(0);
  });

  it('signs a guest straight into a filled demo workspace', async () => {
    const res = await createGuest().expect(201);
    const token = accessTokenOf(res);
    const { user } = res.body;

    expect(user.email.endsWith(`@${GUEST_EMAIL_DOMAIN}`)).toBe(true);
    expect(user.onboardingCompletedAt).not.toBeNull();
    expect(user.workspaceId).toBeTruthy();
    expect(user.lastWorkspaceId).toBe(user.workspaceId);

    const [workspace] = await dataSource.query(
      'SELECT owner_id, demo_of_user_id, currency FROM workspaces WHERE id = $1',
      [user.workspaceId],
    );
    expect(workspace).toEqual({ owner_id: user.id, demo_of_user_id: user.id, currency: 'EUR' });

    const [{ n }] = await dataSource.query(
      'SELECT count(*) AS n FROM transactions WHERE workspace_id = $1',
      [user.workspaceId],
    );
    expect(Number(n)).toBeGreaterThan(0);

    const me = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(me.body.id).toBe(user.id);
  });

  it('gives every visitor a workspace of their own', async () => {
    const first = (await createGuest().expect(201)).body.user;
    const second = (await createGuest().expect(201)).body.user;
    expect(second.id).not.toBe(first.id);
    expect(second.workspaceId).not.toBe(first.workspaceId);
  });

  it('turns visitors away once DEMO_GUESTS_MAX guests are alive', async () => {
    process.env.DEMO_GUESTS_MAX = '1';
    await createGuest().expect(201);
    await createGuest().expect(503);
    expect(await guestCount()).toBe(1);
  });

  it('sweeps guests past the TTL with their workspace, and keeps the fresh ones', async () => {
    process.env.DEMO_GUEST_TTL_HOURS = '24';
    const old = (await createGuest().expect(201)).body.user;
    const fresh = (await createGuest().expect(201)).body.user;
    await dataSource.query('UPDATE users SET created_at = $2 WHERE id = $1', [
      old.id,
      new Date(Date.now() - 2 * DAY_MS),
    ]);

    expect(await guests.removeExpired()).toBe(1);

    const left: Array<{ id: string }> = await dataSource.query(
      'SELECT id FROM users WHERE id = ANY($1)',
      [[old.id, fresh.id]],
    );
    expect(left.map(row => row.id)).toEqual([fresh.id]);
    for (const table of ['workspaces', 'transactions', 'wallets', 'categories']) {
      const column = table === 'workspaces' ? 'id' : 'workspace_id';
      const [{ n }] = await dataSource.query(
        `SELECT count(*) AS n FROM ${table} WHERE ${column} = $1`,
        [old.workspaceId],
      );
      expect({ table, rows: Number(n) }).toEqual({ table, rows: 0 });
    }
  });

  it('removes the other guests when one of them cannot go', async () => {
    const stuck = (await createGuest().expect(201)).body.user;
    const other = (await createGuest().expect(201)).body.user;
    // A row outside the guest's workspace that still names the guest: the
    // users FK on categories has no cascade, so this guest cannot be deleted.
    const [{ id: blockerWorkspace }] = await dataSource.query(
      `INSERT INTO workspaces (name, owner_id, currency) VALUES ('Blocker', $1, 'EUR') RETURNING id`,
      [other.id],
    );
    await dataSource.query(
      `INSERT INTO categories (name, type, workspace_id, user_id) VALUES ('Blocker', 'expense', $1, $2)`,
      [blockerWorkspace, stuck.id],
    );

    expect(await guests.removeExpired(new Date(Date.now() + 365 * DAY_MS))).toBe(1);

    const left: Array<{ id: string }> = await dataSource.query(
      'SELECT id FROM users WHERE id = ANY($1)',
      [[stuck.id, other.id]],
    );
    expect(left.map(row => row.id)).toEqual([stuck.id]);
    // The stuck guest kept its demo: the transaction rolled its workspace back too.
    const [{ n }] = await dataSource.query('SELECT count(*) AS n FROM workspaces WHERE id = $1', [
      stuck.workspaceId,
    ]);
    expect(Number(n)).toBe(1);
    await dataSource.query('DELETE FROM categories WHERE user_id = $1', [stuck.id]);
  });

  it('leaves ordinary accounts alone', async () => {
    const email = `real-${Date.now()}@example.com`;
    const reg = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, password: 'Test123!@#', name: 'Member One' })
      .expect(201);

    await guests.removeExpired(new Date(Date.now() + 365 * DAY_MS));

    const [{ n }] = await dataSource.query('SELECT count(*) AS n FROM users WHERE id = $1', [
      reg.body.user.id,
    ]);
    expect(Number(n)).toBe(1);
    await dataSource.query('DELETE FROM categories WHERE user_id = $1', [reg.body.user.id]);
    await dataSource.query('DELETE FROM users WHERE id = $1', [reg.body.user.id]);
  });
});
