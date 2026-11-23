vi.mock('franc', () => ({
  franc: () => 'und',
}));

import { type INestApplication, ValidationPipe } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
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
