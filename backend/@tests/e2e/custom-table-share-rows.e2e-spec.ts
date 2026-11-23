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

/** A table shared by link reads as the table does, and only its current columns. */
describe('Shared table rows (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  const email = `table-share-${Date.now()}@example.com`;
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
    owner = await registerAccount(app, email, 'Table Share Owner');
  });

  afterAll(async () => {
    if (dataSource) {
      await deleteUserByEmail(dataSource, email);
    }
    await app.close();
  });

  it('shows formulas, leaves out a deleted column, and pages past 200 rows', async () => {
    const table = await as(request(server()).post('/custom-tables')).send({ name: 'Price list' }).expect(201);
    const tableId = table.body.id;
    const price = await as(request(server()).post(`/custom-tables/${tableId}/columns`))
      .send({ title: 'Price', type: 'number' })
      .expect(201);
    const note = await as(request(server()).post(`/custom-tables/${tableId}/columns`))
      .send({ title: 'Private note', type: 'text' })
      .expect(201);
    const doubled = await as(request(server()).post(`/custom-tables/${tableId}/columns`))
      .send({ title: 'Doubled', type: 'formula', config: { expression: `[${price.body.key}]*2` } })
      .expect(201);
    await as(request(server()).post(`/custom-tables/${tableId}/rows`))
      .send({ data: { [price.body.key]: 10, [note.body.key]: 'Member One owes this' } })
      .expect(201);
    // 249 more rows, written straight in: only the share's paging is under test.
    await dataSource.query(
      `INSERT INTO custom_table_rows (table_id, row_number, data)
       SELECT $1, n, jsonb_build_object($2::text, n) FROM generate_series(2, 250) n`,
      [tableId, price.body.key],
    );
    await as(request(server()).delete(`/custom-tables/${tableId}/columns/${note.body.id}`)).expect(200);
    const token = (await as(request(server()).post(`/custom-tables/${tableId}/shares`)).send({}).expect(201))
      .body.token;

    const first = await request(server()).get(`/public/custom-tables/${token}/rows?limit=200`).expect(200);
    expect(first.body.meta.total).toBe(250);
    expect(first.body.items).toHaveLength(200);
    expect(first.body.items[0].data).toEqual({ [price.body.key]: 10, [doubled.body.key]: 20 });
    expect(JSON.stringify(first.body)).not.toContain('Member One owes this');

    const rest = await request(server())
      .get(`/public/custom-tables/${token}/rows?limit=200&cursor=${first.body.items.at(-1).rowNumber}`)
      .expect(200);
    expect(rest.body.items).toHaveLength(50);
  });
});
