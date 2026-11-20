import { existsSync } from 'node:fs';
import { mkdir, rm } from 'node:fs/promises';
import * as path from 'node:path';
import { type INestApplication, ValidationPipe } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import sharp from 'sharp';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { resolveUploadsDir } from '../../src/common/utils/uploads.util';
import { InsightsService } from '../../src/modules/insights/insights.service';
import { DEMO_RECEIPTS } from '../../src/modules/workspaces/demo-workspace/public-demo/demo-receipts.data';
import { publicDemoRefusal } from '../../src/modules/workspaces/demo-workspace/public-demo/public-demo-guard';
import { seedPublicDemo } from '../../src/modules/workspaces/demo-workspace/public-demo/public-demo.seeder';
import { accessTokenOf, deleteUserByEmail, e2eTestingModule } from './helpers/e2e-app';

/**
 * `seed:public-demo` on an empty instance: the shared account signs in to one
 * workspace holding the in-app demo plus receipts, invoices, bills and a
 * crypto account. The receipt images are put in place first, as a reseed
 * finds them, so nothing is downloaded. Runs as a demo instance does, with
 * DEMO_MODE on.
 */
describe('Public demo seed (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  const email = `public-demo-${Date.now()}@example.com`;
  const password = 'Demo-pass-123';
  const folder = path.join(resolveUploadsDir(), 'demo-receipts');
  const placed: string[] = [];
  const demoModeBefore = process.env.DEMO_MODE;
  let workspaceId: string;
  let cleanRun: Record<string, number>;

  const count = async (sql: string, workspace = workspaceId): Promise<number> =>
    Number((await dataSource.query(sql, [workspace]))[0].count);

  /** What a seed leaves in a workspace, to compare a repaired run with a clean one. */
  const contents = async (workspace: string): Promise<Record<string, number>> => {
    const counts: Record<string, number> = {};
    for (const [name, sql] of Object.entries({
      receipts: 'SELECT count(*) FROM receipts WHERE workspace_id = $1',
      booked:
        'SELECT count(DISTINCT transaction_id) FROM receipts WHERE workspace_id = $1 AND transaction_id IS NOT NULL',
      pending: "SELECT count(*) FROM receipts WHERE workspace_id = $1 AND status = 'needs_review'",
      invoices: 'SELECT count(*) FROM invoices WHERE workspace_id = $1',
      payables: 'SELECT count(*) FROM payables WHERE workspace_id = $1',
      cryptoWallets: 'SELECT count(*) FROM crypto_wallets WHERE workspace_id = $1',
      cryptoRows:
        'SELECT count(*) FROM transactions WHERE workspace_id = $1 AND crypto_wallet_id IS NOT NULL',
      transactions: 'SELECT count(*) FROM transactions WHERE workspace_id = $1',
      advice: 'SELECT count(*) FROM insights WHERE workspace_id = $1',
    })) {
      counts[name] = await count(sql, workspace);
    }
    return counts;
  };

  beforeAll(async () => {
    process.env.DEMO_MODE = 'true';
    await mkdir(folder, { recursive: true });
    for (const receipt of DEMO_RECEIPTS) {
      const file = path.join(folder, `${receipt.key}.jpg`);
      if (existsSync(file)) continue;
      await sharp({ create: { width: 40, height: 120, channels: 3, background: '#ffffff' } })
        .jpeg()
        .toFile(file);
      placed.push(file);
    }
    const moduleFixture: TestingModule = await e2eTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    dataSource = moduleFixture.get(DataSource);
  });

  afterAll(async () => {
    if (dataSource) await deleteUserByEmail(dataSource, email);
    for (const file of placed) await rm(file, { force: true });
    await app.close();
    if (demoModeBefore === undefined) delete process.env.DEMO_MODE;
    else process.env.DEMO_MODE = demoModeBefore;
  });

  it('makes the shared account and lands it in the demo workspace', async () => {
    expect(await seedPublicDemo(app, { email, password })).toBe(true);

    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password })
      .expect(200);
    workspaceId = login.body.user.lastWorkspaceId;
    expect(login.body.user.onboardingCompletedAt).not.toBeNull();
    const [workspace] = await dataSource.query(
      'SELECT demo_of_user_id FROM workspaces WHERE id = $1',
      [workspaceId],
    );
    expect(workspace.demo_of_user_id).toBe(login.body.user.id);

    const token = accessTokenOf(login);
    for (const url of ['/receipts/documents', '/invoices', '/payables', '/statements']) {
      await request(app.getHttpServer())
        .get(url)
        .set('Authorization', `Bearer ${token}`)
        .set('x-workspace-id', workspaceId)
        .expect(200);
    }
  });

  it('files every receipt, books those not left for review, and none twice', async () => {
    const pending = DEMO_RECEIPTS.filter(receipt => receipt.pending).length;
    expect(await count('SELECT count(*) FROM receipts WHERE workspace_id = $1')).toBe(
      DEMO_RECEIPTS.length,
    );
    expect(
      await count(
        'SELECT count(DISTINCT transaction_id) FROM receipts WHERE workspace_id = $1 AND transaction_id IS NOT NULL',
      ),
    ).toBe(DEMO_RECEIPTS.length - pending);
    expect(
      await count(
        "SELECT count(*) FROM receipts WHERE workspace_id = $1 AND status = 'needs_review'",
      ),
    ).toBe(pending);
  });

  it('sends three invoices, keeps one draft, and settles one with a booked income row', async () => {
    const invoices: Array<{ status: string }> = await dataSource.query(
      'SELECT status FROM invoices WHERE workspace_id = $1 ORDER BY status',
      [workspaceId],
    );
    expect(invoices.map(invoice => invoice.status)).toEqual(['draft', 'sent', 'sent', 'sent']);
    expect(
      await count(
        "SELECT count(*) FROM payables WHERE workspace_id = $1 AND status = 'paid' AND linked_transaction_id IS NOT NULL",
      ),
    ).toBe(2);
    expect(await count('SELECT count(*) FROM payables WHERE workspace_id = $1')).toBe(7);
  });

  it('imports a crypto account from its CSV', async () => {
    expect(await count('SELECT count(*) FROM crypto_wallets WHERE workspace_id = $1')).toBe(1);
    expect(
      await count(
        'SELECT count(*) FROM transactions WHERE workspace_id = $1 AND crypto_wallet_id IS NOT NULL',
      ),
    ).toBeGreaterThanOrEqual(7);
  });

  it('writes the advice a visitor reads', async () => {
    cleanRun = await contents(workspaceId);
    expect(cleanRun.advice).toBeGreaterThan(0);
  });

  it('leaves an instance that already has the account alone', async () => {
    expect(await seedPublicDemo(app, { email, password })).toBe(false);
    expect(await count('SELECT count(*) FROM receipts WHERE workspace_id = $1')).toBe(
      DEMO_RECEIPTS.length,
    );
  });

  it('repairs a seed that died midway on the next run', async () => {
    const halfEmail = `public-demo-half-${Date.now()}@example.com`;
    try {
      const refresh = vi
        .spyOn(app.get(InsightsService), 'refresh')
        .mockRejectedValueOnce(new Error('advice failed'));
      await expect(seedPublicDemo(app, { email: halfEmail, password })).rejects.toThrow(
        'advice failed',
      );
      const [half] = await dataSource.query(
        'SELECT u.id, u.is_active, w.id AS workspace_id FROM users u JOIN workspaces w ON w.owner_id = u.id WHERE u.email = $1',
        [halfEmail],
      );
      expect(half.is_active).toBe(false);
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: halfEmail, password })
        .expect(401);

      expect(await seedPublicDemo(app, { email: halfEmail, password })).toBe(true);
      expect(refresh).toHaveBeenCalledTimes(2);
      const workspaces: Array<{ id: string }> = await dataSource.query(
        'SELECT id FROM workspaces WHERE owner_id = $1',
        [half.id],
      );
      expect(workspaces).toHaveLength(1);
      expect(workspaces[0].id).not.toBe(half.workspace_id);
      expect(await contents(workspaces[0].id)).toEqual(cleanRun);
      const login = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: halfEmail, password })
        .expect(200);
      expect(login.body.user.lastWorkspaceId).toBe(workspaces[0].id);
      expect(await seedPublicDemo(app, { email: halfEmail, password })).toBe(false);
    } finally {
      await dataSource.query(
        'DELETE FROM workspaces WHERE owner_id IN (SELECT id FROM users WHERE email = $1)',
        [halfEmail],
      );
      await deleteUserByEmail(dataSource, halfEmail);
    }
  });

  it('refuses an instance where another account lives', async () => {
    const other = `public-demo-other-${Date.now()}@example.com`;
    await dataSource.query(
      "INSERT INTO users (email, password_hash, name) VALUES ($1, 'not-a-hash', 'Member One')",
      [other],
    );
    try {
      expect(await publicDemoRefusal(dataSource, email)).toMatch(/other account/);
    } finally {
      await deleteUserByEmail(dataSource, other);
    }
  });

  it('refuses an instance that is not a demo', async () => {
    process.env.DEMO_MODE = 'false';
    try {
      expect(await publicDemoRefusal(dataSource, email)).toMatch(/DEMO_MODE/);
    } finally {
      process.env.DEMO_MODE = 'true';
    }
  });
});
