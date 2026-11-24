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
 * A subscription in a currency with no rate to the workspace's still counts
 * at face value, as on the dashboard, but the summary now names the currency
 * so the page can say the total is not exact (#787).
 */
describe('Subscriptions summary with a missing rate (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  const email = `subs-missing-rate-${Date.now()}@example.com`;
  let owner: E2eAccount;

  const as = (req: request.Test) =>
    req.set('Authorization', `Bearer ${owner.token}`).set('x-workspace-id', owner.workspaceId);
  const server = () => app.getHttpServer();
  const inDays = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
  const subscribe = async (vendorName: string, currency: string) => {
    const created = await as(request(server()).post('/subscriptions'))
      .send({ vendorName, amount: 10, frequency: 'monthly', currency, nextChargeDate: inDays(5) })
      .expect(201);
    await as(request(server()).post(`/subscriptions/${created.body.id}/confirm`)).expect(201);
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await e2eTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    dataSource = moduleFixture.get(DataSource);
    owner = await registerAccount(app, email, 'Member One');
    await as(request(server()).patch(`/workspaces/${owner.workspaceId}`))
      .send({ currency: 'EUR' })
      .expect(200);
  });

  afterAll(async () => {
    if (dataSource) {
      await deleteUserByEmail(dataSource, email);
    }
    await app.close();
  });

  it('names nothing while every subscription is in the workspace currency', async () => {
    await subscribe('ACME Music', 'EUR');

    const summary = await as(request(server()).get('/subscriptions/summary')).expect(200);

    expect(summary.body.missingRates).toBeUndefined();
    expect(summary.body.totalMonthlyCost).toBe(10);
  });

  it('names a currency with no rate, and still counts it at face value', async () => {
    // XTS is the code ISO keeps for testing: no source has a rate for it.
    await subscribe('ACME Test Plan', 'XTS');

    const summary = await as(request(server()).get('/subscriptions/summary')).expect(200);

    expect(summary.body.missingRates).toEqual(['XTS']);
    expect(summary.body.totalMonthlyCost).toBe(20);
  });

  it('names a bill currency without a rate in the charge calendar (#787)', async () => {
    // XBB (a bond unit, no rate source), on no plan: only the bill can bring it in.
    await as(request(server()).post('/payables'))
      .send({ vendor: 'ACME Vault', amount: 25, currency: 'XBB', dueDate: inDays(5) })
      .expect(201);

    const calendar = await as(request(server()).get('/subscriptions/charge-calendar?months=2')).expect(200);

    expect(calendar.body.missingRates).toEqual(['XBB', 'XTS']);
    const bill = calendar.body.rows.find((row: { vendorName: string }) => row.vendorName === 'ACME Vault');
    expect(bill.amounts[0]).toBe(25);
  });
});
