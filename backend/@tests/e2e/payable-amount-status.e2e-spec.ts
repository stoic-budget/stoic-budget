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

/** A bill's status follows its payments when its amount changes. */
describe('Changing a bill amount (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  const email = `payable-amount-${Date.now()}@example.com`;
  let owner: E2eAccount;

  const as = (req: request.Test) =>
    req.set('Authorization', `Bearer ${owner.token}`).set('x-workspace-id', owner.workspaceId);
  const server = () => app.getHttpServer();

  async function billPaid(amount: number, paid: number): Promise<string> {
    const bill = await as(request(server()).post('/payables'))
      .send({ vendor: 'ACME Store', amount, currency: 'USD' })
      .expect(201);
    await as(request(server()).post(`/payables/${bill.body.id}/payments`))
      .send({ amount: paid })
      .expect(201);
    return bill.body.id;
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await e2eTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    dataSource = moduleFixture.get<DataSource>(DataSource);
    owner = await registerAccount(app, email, 'Payable Amount Owner');
  });

  afterAll(async () => {
    if (dataSource) {
      await deleteUserByEmail(dataSource, email);
    }
    await app.close();
  });

  it('turns a paid bill part paid when its amount grows', async () => {
    const id = await billPaid(100, 100);

    const edited = await as(request(server()).put(`/payables/${id}`)).send({ amount: 150 }).expect(200);

    expect(edited.body).toMatchObject({ status: 'partially_paid', paidAt: null });
    expect(Number(edited.body.paidAmount)).toBe(100);
  });

  it('turns a part-paid bill paid when its amount falls to what was paid', async () => {
    const id = await billPaid(100, 40);

    const edited = await as(request(server()).put(`/payables/${id}`)).send({ amount: 40 }).expect(200);

    expect(edited.body.status).toBe('paid');
  });

  it('leaves the status alone when only the vendor changes', async () => {
    const id = await billPaid(100, 40);

    const edited = await as(request(server()).put(`/payables/${id}`))
      .send({ vendor: 'ACME Store Ltd' })
      .expect(200);

    expect(edited.body.status).toBe('partially_paid');
  });
});
