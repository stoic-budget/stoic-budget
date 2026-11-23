vi.mock('franc', () => ({
  franc: () => 'und',
}));

import { type INestApplication, ValidationPipe } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { SubscriptionDetectionService } from '../../src/modules/subscriptions/subscription-detection.service';
import { SubscriptionsService } from '../../src/modules/subscriptions/subscriptions.service';
import {
  deleteUserByEmail,
  type E2eAccount,
  e2eTestingModule,
  registerAccount,
} from './helpers/e2e-app';

/** A subscription billed on the 31st comes back to the 31st after February (#662). */
describe('Subscription billing day (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  const email = `billing-day-${Date.now()}@example.com`;
  let owner: E2eAccount;

  const as = (req: request.Test) =>
    req.set('Authorization', `Bearer ${owner.token}`).set('x-workspace-id', owner.workspaceId);
  const server = () => app.getHttpServer();
  const stored = async (id: string) =>
    (
      await dataSource.query(
        "SELECT to_char(next_charge_date, 'YYYY-MM-DD') AS next, billing_day FROM subscriptions WHERE id = $1",
        [id],
      )
    )[0] as { next: string; billing_day: number };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await e2eTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    dataSource = moduleFixture.get<DataSource>(DataSource);
    owner = await registerAccount(app, email, 'Member One');
  });

  afterAll(async () => {
    if (dataSource) {
      await deleteUserByEmail(dataSource, email);
    }
    await app.close();
  });

  it('steps 31 Jan to 28 Feb and back to 31 Mar, not the 28th for good', async () => {
    const created = await as(request(server()).post('/subscriptions'))
      .send({
        vendorName: 'ACME Streaming',
        amount: 9.99,
        currency: 'EUR',
        frequency: 'monthly',
        nextChargeDate: '2026-01-31',
      })
      .expect(201);
    expect(await stored(created.body.id)).toEqual({ next: '2026-01-31', billing_day: 31 });

    const service = app.get(SubscriptionsService);
    await service.updatePastDueNextDates();
    expect(await stored(created.body.id)).toEqual({ next: '2026-02-28', billing_day: 31 });
    await service.updatePastDueNextDates();
    expect(await stored(created.body.id)).toEqual({ next: '2026-03-31', billing_day: 31 });
  });

  it('detects the 31st from charges a short month clamped, and keeps it on the next upload', async () => {
    const category = await as(request(server()).post('/categories'))
      .send({ name: 'Music', type: 'expense' })
      .expect(201);
    for (const date of ['2026-07-31', '2026-08-31', '2026-09-30']) {
      await as(request(server()).post('/statements/manual-expense'))
        .field('amount', '11.99')
        .field('currency', 'EUR')
        .field('merchant', 'ACME Music')
        .field('categoryId', category.body.id)
        .field('date', date)
        .expect(201);
    }
    const detection = app.get(SubscriptionDetectionService);

    await detection.runDetection(owner.workspaceId);
    const [found] = await dataSource.query(
      "SELECT id FROM subscriptions WHERE workspace_id = $1 AND vendor_name ILIKE '%acme music%'",
      [owner.workspaceId],
    );
    expect(await stored(found.id)).toEqual({ next: '2026-10-31', billing_day: 31 });

    await detection.runDetection(owner.workspaceId);
    expect(await stored(found.id)).toEqual({ next: '2026-10-31', billing_day: 31 });
  });

  it('steps a row without a billing day (an old backup) from its own day', async () => {
    const created = await as(request(server()).post('/subscriptions'))
      .send({
        vendorName: 'ACME Cloud',
        amount: 5,
        currency: 'EUR',
        frequency: 'monthly',
        nextChargeDate: '2026-01-31',
      })
      .expect(201);
    await dataSource.query('UPDATE subscriptions SET billing_day = NULL WHERE id = $1', [
      created.body.id,
    ]);

    const service = app.get(SubscriptionsService);
    await service.updatePastDueNextDates();
    await service.updatePastDueNextDates();

    expect(await stored(created.body.id)).toEqual({ next: '2026-03-31', billing_day: 31 });
  });

  it('takes a date set by hand as the new billing day', async () => {
    const created = await as(request(server()).post('/subscriptions'))
      .send({
        vendorName: 'ACME Gym',
        amount: 30,
        currency: 'EUR',
        frequency: 'monthly',
        nextChargeDate: '2026-12-31',
      })
      .expect(201);

    await as(request(server()).put(`/subscriptions/${created.body.id}`))
      .send({ nextChargeDate: '2027-01-15' })
      .expect(200);

    expect(await stored(created.body.id)).toEqual({ next: '2027-01-15', billing_day: 15 });
  });
});
