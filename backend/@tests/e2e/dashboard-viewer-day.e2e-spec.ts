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

/** "This month" on the dashboard is the viewer's month, by the day they send. */
describe('Dashboard month by the viewer day (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  const email = `dashboard-day-${Date.now()}@example.com`;
  let owner: E2eAccount;

  const as = (req: request.Test) =>
    req.set('Authorization', `Bearer ${owner.token}`).set('x-workspace-id', owner.workspaceId);
  const server = () => app.getHttpServer();
  const pad = (n: number) => String(n).padStart(2, '0');
  const now = new Date();
  const today = `${now.getUTCFullYear()}-${pad(now.getUTCMonth() + 1)}-${pad(now.getUTCDate())}`;
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  const nextFirst = `${next.getUTCFullYear()}-${pad(next.getUTCMonth() + 1)}-01`;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await e2eTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    dataSource = moduleFixture.get<DataSource>(DataSource);
    owner = await registerAccount(app, email, 'Dashboard Owner');
    const categories = await as(request(server()).get('/categories?type=expense')).expect(200);
    const category = (categories.body as Array<{ id: string; parentId: string | null }>).find(item => !item.parentId);
    for (const [amount, date, merchant] of [
      ['50', today, 'ACME Store - This month'],
      ['30', nextFirst, 'ACME Store - Next month'],
    ]) {
      await as(request(server()).post('/statements/manual-expense'))
        .field('amount', amount)
        .field('currency', 'USD')
        .field('merchant', merchant)
        .field('categoryId', category?.id ?? '')
        .field('date', date)
        .expect(201);
    }
  });

  afterAll(async () => {
    if (dataSource) {
      await deleteUserByEmail(dataSource, email);
    }
    await app.close();
  });

  it("shows the viewer's month when their day is already the next one", async () => {
    // East of UTC on the 1st: the viewer's day is next month while the server's is not.
    const res = await as(request(server()).get(`/dashboard?range=month&today=${nextFirst}`)).expect(200);

    expect(Number(res.body.snapshot.expense30d)).toBe(30);
  });

  it("keeps the server's month without a day", async () => {
    const res = await as(request(server()).get('/dashboard?range=month')).expect(200);

    expect(Number(res.body.snapshot.expense30d)).toBe(50);
  });
});
