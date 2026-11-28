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

/** Emptying the trash deletes for good, and leaves the rest of the books right (#678). */
describe('Trash purge (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  const email = `trash-purge-${Date.now()}@example.com`;
  let owner: E2eAccount;
  let categoryId: string;
  let made = 0;

  const as = (req: request.Test) =>
    req.set('Authorization', `Bearer ${owner.token}`).set('x-workspace-id', owner.workspaceId);
  const server = () => app.getHttpServer();
  /** A one-row statement in the trash or not: its id and its row's id. */
  const statement = async (trashed: boolean) => {
    const created = await as(request(server()).post('/statements/manual-expense'))
      // A different amount each: the same expense twice is refused as a repeat.
      .field('amount', String(25 + ++made))
      .field('currency', 'EUR')
      .field('merchant', 'ACME Store - Wireless Buds')
      .field('categoryId', categoryId)
      .field('date', '2026-03-02')
      .expect(201);
    const [row] = await dataSource.query('SELECT id FROM transactions WHERE statement_id = $1', [
      created.body.id,
    ]);
    if (trashed) {
      await as(request(server()).post(`/storage/files/${created.body.id}/trash`)).expect(201);
    }
    return { id: created.body.id as string, rowId: row.id as string };
  };
  const left = async (ids: string[]) =>
    (
      await dataSource.query('SELECT count(*)::int AS n FROM statements WHERE id = ANY($1::uuid[])', [
        ids,
      ])
    )[0].n;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await e2eTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    dataSource = moduleFixture.get<DataSource>(DataSource);
    owner = await registerAccount(app, email, 'Member One');
    const category = await as(request(server()).post('/categories'))
      .send({ name: 'Gadgets', type: 'expense' })
      .expect(201);
    categoryId = category.body.id;
  });

  afterAll(async () => {
    if (dataSource) {
      await deleteUserByEmail(dataSource, email);
    }
    await app.close();
  });

  it("counts a copy again once its original's statement is deleted for good", async () => {
    const original = await statement(true);
    const copy = await statement(false);
    await dataSource.query(
      'UPDATE transactions SET is_duplicate = true, duplicate_of_id = $1 WHERE id = $2',
      [original.rowId, copy.rowId],
    );

    await as(request(server()).delete(`/storage/files/${original.id}/trash`)).expect(200);

    const [row] = await dataSource.query(
      'SELECT is_duplicate, duplicate_of_id FROM transactions WHERE id = $1',
      [copy.rowId],
    );
    expect(row).toEqual({ is_duplicate: false, duplicate_of_id: null });
    expect(await left([original.id])).toBe(0);
  });

  it('deletes none of a batch when one has a row on a filed return', async () => {
    const first = await statement(true);
    const filed = await statement(true);
    await dataSource.query(
      'UPDATE transactions SET tax_locked = true, tax_amount = 0 WHERE id = $1',
      [filed.rowId],
    );

    await as(request(server()).post('/storage/files/bulk/trash/delete'))
      .send({ statementIds: [first.id, filed.id] })
      .expect(409);

    expect(await left([first.id, filed.id])).toBe(2);
  });

  it('refuses to delete for good a statement that is not in the trash', async () => {
    const live = await statement(false);

    await as(request(server()).delete(`/storage/files/${live.id}/trash`)).expect(400);

    expect(await left([live.id])).toBe(1);
  });
});
