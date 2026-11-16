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
import { DEMO_RECEIPTS } from '../../src/modules/workspaces/demo-workspace/public-demo/demo-receipts.data';
import { seedPublicDemo } from '../../src/modules/workspaces/demo-workspace/public-demo/public-demo.seeder';
import { accessTokenOf, deleteUserByEmail, e2eTestingModule } from './helpers/e2e-app';

/**
 * `seed:public-demo` on an empty instance: the shared account signs in to one
 * workspace holding the in-app demo plus receipts, invoices, bills and a
 * crypto account. The receipt images are put in place first, as a reseed
 * finds them, so nothing is downloaded.
 */
describe('Public demo seed (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  const email = `public-demo-${Date.now()}@example.com`;
  const password = 'Demo-pass-123';
  const folder = path.join(resolveUploadsDir(), 'demo-receipts');
  const placed: string[] = [];
  let workspaceId: string;

  const count = async (sql: string): Promise<number> =>
    Number((await dataSource.query(sql, [workspaceId]))[0].count);

  beforeAll(async () => {
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

  it('leaves an instance that already has the account alone', async () => {
    expect(await seedPublicDemo(app, { email, password })).toBe(false);
    expect(await count('SELECT count(*) FROM receipts WHERE workspace_id = $1')).toBe(
      DEMO_RECEIPTS.length,
    );
  });
});
