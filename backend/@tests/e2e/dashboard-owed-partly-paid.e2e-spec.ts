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

const dayFromToday = (days: number) =>
  new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);

/** The "You owe" card counts what is left of a partly paid bill, as the Pay page does. */
describe('Dashboard owed card and partly paid bills (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  const email = `owed-partly-${Date.now()}@example.com`;
  let owner: E2eAccount;

  const as = (req: request.Test) =>
    req.set('Authorization', `Bearer ${owner.token}`).set('x-workspace-id', owner.workspaceId);
  const server = () => app.getHttpServer();
  const snapshot = async () =>
    (await as(request(server()).get('/dashboard')).expect(200)).body.snapshot as {
      totalPayable: number;
      totalOverdue: number;
      currency: string;
    };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await e2eTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    dataSource = moduleFixture.get<DataSource>(DataSource);
    owner = await registerAccount(app, email, 'Owed Owner');
  });

  afterAll(async () => {
    if (dataSource) {
      await deleteUserByEmail(dataSource, email);
    }
    await app.close();
  });

  it('shows the remainder of a partly paid bill, and moves it to overdue after its date', async () => {
    const { currency } = await snapshot();
    const bill = await as(request(server()).post('/payables'))
      .send({ vendor: 'ACME Store', amount: 1000, currency, dueDate: dayFromToday(7) })
      .expect(201);
    await as(request(server()).post(`/payables/${bill.body.id}/payments`))
      .send({ amount: 400 })
      .expect(201);

    expect(await snapshot()).toMatchObject({ totalPayable: 600, totalOverdue: 0 });

    await dataSource.query('UPDATE payables SET due_date = $2 WHERE id = $1', [
      bill.body.id,
      dayFromToday(-3),
    ]);
    expect(await snapshot()).toMatchObject({ totalPayable: 0, totalOverdue: 600 });
  });

  it('counts a bill with no due date as owed, never overdue', async () => {
    const { currency, totalPayable } = await snapshot();
    await as(request(server()).post('/payables'))
      .send({ vendor: 'Corner Cafe', amount: 300, currency })
      .expect(201);

    expect(await snapshot()).toMatchObject({ totalPayable: totalPayable + 300 });
  });
});
