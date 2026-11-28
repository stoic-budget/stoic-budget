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
 * The forecast places what the workspace already knows (a bill, a
 * subscription, an invoice) on the days ahead, answers "safe to spend", and
 * lets a scenario drop a source. Another workspace sees an empty curve.
 */
describe('Forecast (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  const stamp = Date.now();
  const emails = {
    owner: `forecast-owner-${stamp}@example.com`,
    other: `forecast-other-${stamp}@example.com`,
  };
  let owner: E2eAccount;
  let other: E2eAccount;
  let payableId: string;

  const as = (account: E2eAccount, req: request.Test) =>
    req.set('Authorization', `Bearer ${account.token}`).set('x-workspace-id', account.workspaceId);
  const server = () => app.getHttpServer();
  const inDays = (days: number) => {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date.toISOString().slice(0, 10);
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await e2eTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    dataSource = moduleFixture.get<DataSource>(DataSource);

    owner = await registerAccount(app, emails.owner, 'Forecast Owner');
    other = await registerAccount(app, emails.other, 'Forecast Other');
    // Everything below is in dollars; the workspace default would convert it.
    await as(owner, request(server()).patch(`/workspaces/${owner.workspaceId}`))
      .send({ currency: 'USD' })
      .expect(200);

    const payable = await as(owner, request(server()).post('/payables'))
      .send({ vendor: 'Landlord', amount: 500, currency: 'USD', dueDate: inDays(5) })
      .expect(201);
    payableId = payable.body.id;
    const subscription = await as(owner, request(server()).post('/subscriptions'))
      .send({
        vendorName: 'Netflix',
        amount: 20,
        frequency: 'monthly',
        currency: 'USD',
        nextChargeDate: inDays(10),
      })
      .expect(201);
    await as(owner, request(server()).post(`/subscriptions/${subscription.body.id}/confirm`)).expect(
      201,
    );
  });

  afterAll(async () => {
    if (dataSource) {
      for (const email of Object.values(emails)) {
        await deleteUserByEmail(dataSource, email);
      }
    }
    await app.close();
  });

  it('places the bill and the subscription on their days and finds the low point', async () => {
    const res = await as(owner, request(server()).get('/forecast?days=30')).expect(200);

    expect(res.body.horizonDays).toBe(30);
    expect(res.body.days).toHaveLength(30);
    expect(res.body.profile).toBe('business');
    const kinds = res.body.events.map((event: { kind: string; label: string; amount: number }) => [
      event.kind,
      event.label,
      event.amount,
    ]);
    expect(kinds).toEqual(
      expect.arrayContaining([
        ['payable', 'Landlord', -500],
        ['subscription', 'Netflix', -20],
      ]),
    );
    expect(res.body.lowestBalance).toBeLessThanOrEqual(res.body.openingBalance - 520);
    expect(res.body.safeToSpend.amount).toBeGreaterThanOrEqual(0);
  });

  it('drops a source in a scenario and scales the rest', async () => {
    const res = await as(
      owner,
      request(server()).get(`/forecast?days=30&exclude=${payableId}&expenseFactor=1.5`),
    ).expect(200);

    const sources = res.body.events.map((event: { sourceId: string }) => event.sourceId);
    expect(sources).not.toContain(payableId);
    expect(res.body.events.find((event: { label: string }) => event.label === 'Netflix').amount).toBe(
      -30,
    );
  });

  it('expects the money a client owes on its due date', async () => {
    await as(owner, request(server()).post('/payables'))
      .send({
        direction: 'receivable',
        vendor: 'Client Co',
        amount: 800,
        currency: 'USD',
        dueDate: inDays(7),
      })
      .expect(201);

    const res = await as(owner, request(server()).get('/forecast?days=30')).expect(200);

    expect(res.body.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'invoice', label: 'Client Co', amount: 800 }),
      ]),
    );
  });

  it('takes an open invoice of a regular payer for its next payday, not one more', async () => {
    const payday = (monthsBack: number) => {
      const date = new Date(`${inDays(7)}T00:00:00Z`);
      date.setUTCMonth(date.getUTCMonth() - monthsBack);
      return date.toISOString().slice(0, 10);
    };
    for (const monthsBack of [1, 2, 3]) {
      await dataSource.query(
        `INSERT INTO transactions (workspace_id, transaction_date, counterparty_name, payment_purpose,
           amount, credit, currency, transaction_type, is_verified)
         VALUES ($1, $2, 'ACME Client', 'Retainer', 1000, 1000, 'USD', 'income', true)`,
        [owner.workspaceId, payday(monthsBack)],
      );
    }
    const before = await as(owner, request(server()).get('/forecast?days=30')).expect(200);
    const acme = (body: { events: Array<{ label: string; amount: number }> }) =>
      body.events.filter(event => event.label.startsWith('ACME Client')).map(event => event.amount);
    expect(acme(before.body)).toEqual([1000]);

    await as(owner, request(server()).post('/payables'))
      .send({ direction: 'receivable', vendor: 'ACME Client', amount: 1000, currency: 'USD', dueDate: inDays(7) })
      .expect(201);
    const after = await as(owner, request(server()).get('/forecast?days=30')).expect(200);

    expect(acme(after.body)).toEqual([1000]);
    expect(after.body.safeToSpend.untilDate < inDays(7)).toBe(true);
  });

  it('accepts only the three horizons', () => {
    return as(owner, request(server()).get('/forecast?days=45')).expect(400);
  });

  it('shows another workspace nothing', async () => {
    const res = await as(other, request(server()).get('/forecast?days=30')).expect(200);
    expect(res.body.events).toEqual([]);
  });
});
