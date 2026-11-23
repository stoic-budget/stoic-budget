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

/** Undoing a cell edit from the audit log recomputes the formulas beside it. */
describe('Table formulas after a rollback (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  const email = `table-rollback-${Date.now()}@example.com`;
  let owner: E2eAccount;

  const as = (req: request.Test) =>
    req.set('Authorization', `Bearer ${owner.token}`).set('x-workspace-id', owner.workspaceId);
  const server = () => app.getHttpServer();

  beforeAll(async () => {
    const moduleFixture: TestingModule = await e2eTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    dataSource = moduleFixture.get<DataSource>(DataSource);
    owner = await registerAccount(app, email, 'Table Rollback Owner');
    // Rolling back from the audit log is for admins.
    await dataSource.query(`UPDATE users SET role = 'admin' WHERE id = $1`, [owner.userId]);
  });

  afterAll(async () => {
    if (dataSource) {
      await deleteUserByEmail(dataSource, email);
    }
    await app.close();
  });

  it('shows the formula of the restored value', async () => {
    const table = await as(request(server()).post('/custom-tables')).send({ name: 'Costs' }).expect(201);
    const tableId = table.body.id;
    const amount = await as(request(server()).post(`/custom-tables/${tableId}/columns`))
      .send({ title: 'Amount', type: 'number' })
      .expect(201);
    const doubled = await as(request(server()).post(`/custom-tables/${tableId}/columns`))
      .send({ title: 'Doubled', type: 'formula', config: { expression: `[${amount.body.key}]*2` } })
      .expect(201);
    const row = await as(request(server()).post(`/custom-tables/${tableId}/rows`))
      .send({ data: { [amount.body.key]: 10 } })
      .expect(201);
    await as(request(server()).patch(`/custom-tables/${tableId}/rows/${row.body.id}`))
      .send({ data: { [amount.body.key]: 20 } })
      .expect(200);
    const doubledOf = async () => {
      const rows = await as(request(server()).get(`/custom-tables/${tableId}/rows`)).expect(200);
      const items = rows.body.items ?? rows.body.data ?? rows.body;
      return Number(items.find((item: { id: string }) => item.id === row.body.id).data[doubled.body.key]);
    };
    expect(await doubledOf()).toBe(40);

    const history = await as(
      request(server()).get(`/audit-events/entity/table_cell/${row.body.id}`),
    ).expect(200);
    await as(request(server()).post(`/audit-events/${history.body[0].id}/rollback`)).expect(201);

    expect(await doubledOf()).toBe(20);
  });
});
