vi.mock('franc', () => ({
  franc: () => 'und',
}));

import { type INestApplication, ValidationPipe } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import {
  deleteUserByEmail,
  type E2eAccount,
  e2eTestingModule,
  registerAccount,
} from './helpers/e2e-app';

/**
 * An idempotency key is taken before the work starts: "save as paid" pressed
 * twice books one bill and one payment, a repeat after it gets the first
 * answer, and a request that failed leaves the key free for its retry.
 */
describe('Idempotency key race (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  const email = `idem-race-${Date.now()}@example.com`;
  let owner: E2eAccount;

  const save = (key: string, vendor: string, payment: Record<string, unknown> = { inHand: true }) =>
    request(app.getHttpServer())
      .post('/payables')
      .set('Authorization', `Bearer ${owner.token}`)
      .set('x-workspace-id', owner.workspaceId)
      .set('idempotency-key', key)
      .send({ vendor, amount: 42, currency: 'EUR', payment: { ...payment, paidOn: '2026-09-03' } });
  const count = async (vendor: string) => {
    const [bills] = await dataSource.query(
      'SELECT count(*)::int AS n FROM payables WHERE workspace_id = $1 AND vendor = $2',
      [owner.workspaceId, vendor],
    );
    const [rows] = await dataSource.query(
      'SELECT count(*)::int AS n FROM transactions WHERE workspace_id = $1 AND counterparty_name = $2',
      [owner.workspaceId, vendor],
    );
    return { bills: bills.n, payments: rows.n };
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await e2eTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    dataSource = moduleFixture.get<DataSource>(DataSource);
    owner = await registerAccount(app, email, 'Idempotency Owner');
  });

  afterAll(async () => {
    if (dataSource) {
      await deleteUserByEmail(dataSource, email);
    }
    await app.close();
  });

  it('books one bill and one payment when "save as paid" is sent twice at once', async () => {
    const vendor = 'ACME Store - Twice';
    const answers = await Promise.all([save('race-1', vendor), save('race-1', vendor)]);

    const statuses = answers.map(answer => answer.status).sort();
    // The second either waits for nothing and gets 409, or comes after and gets the first bill.
    expect([['201', '409'].join(), ['201', '201'].join()]).toContain(statuses.join());
    expect(await count(vendor)).toEqual({ bills: 1, payments: 1 });
  });

  it('answers a repeat after the first finished with the same bill', async () => {
    const vendor = 'ACME Store - Repeat';
    const first = await save('repeat-1', vendor).expect(201);

    const again = await save('repeat-1', vendor).expect(201);

    expect(again.body.id).toBe(first.body.id);
    expect(await count(vendor)).toEqual({ bills: 1, payments: 1 });
  });

  it('frees the key of a request that failed, for its retry', async () => {
    const vendor = 'ACME Store - Retry';
    // Fails inside the work: a wallet that is not there.
    const failed = await save('retry-1', vendor, { payFromWalletId: '00000000-0000-4000-8000-000000000000' });
    expect(failed.status).toBeGreaterThanOrEqual(400);

    await save('retry-1', vendor).expect(201);

    expect(await count(vendor)).toEqual({ bills: 1, payments: 1 });
  });
});
