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

const MERCHANT = 'ACME Store - Wireless Buds';

/** A row of a statement in the Trash is not a search hit; restored, it is again. */
describe('Search and the Trash (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  const email = `search-trash-${Date.now()}@example.com`;
  let owner: E2eAccount;

  const as = (req: request.Test) =>
    req.set('Authorization', `Bearer ${owner.token}`).set('x-workspace-id', owner.workspaceId);
  const server = () => app.getHttpServer();
  const hits = async () =>
    (await as(request(server()).get('/search?q=wireless')).expect(200)).body.results.filter(
      (hit: { kind: string }) => hit.kind === 'transaction',
    );

  beforeAll(async () => {
    const moduleFixture: TestingModule = await e2eTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    dataSource = moduleFixture.get<DataSource>(DataSource);
    owner = await registerAccount(app, email, 'Search Owner');
  });

  afterAll(async () => {
    if (dataSource) {
      await deleteUserByEmail(dataSource, email);
    }
    await app.close();
  });

  it('hides the rows of a trashed statement and shows them again once restored', async () => {
    const categories = await as(request(server()).get('/categories?type=expense')).expect(200);
    const statement = await as(request(server()).post('/statements/manual-expense'))
      .field('amount', '129')
      .field('currency', 'EUR')
      .field('merchant', MERCHANT)
      .field('categoryId', categories.body[0].id)
      .field('date', '2026-10-05')
      .expect(201);
    expect(await hits()).toHaveLength(1);

    await as(request(server()).post(`/statements/${statement.body.id}/trash`)).expect(200);
    expect(await hits()).toHaveLength(0);

    await as(request(server()).post(`/statements/${statement.body.id}/restore`)).expect(201);
    expect(await hits()).toHaveLength(1);
  });
});
