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

/** A copy flagged as the duplicate of a row that goes keeps an original. */
describe('Duplicates of deleted rows (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  const email = `dup-deleted-${Date.now()}@example.com`;
  let owner: E2eAccount;

  const as = (req: request.Test) =>
    req.set('Authorization', `Bearer ${owner.token}`).set('x-workspace-id', owner.workspaceId);

  const statement = async () =>
    (
      await dataSource.query(
        `INSERT INTO statements (user_id, workspace_id, file_name, file_path, file_type, file_size,
           file_hash, bank_name, status, currency)
         VALUES ($1, $2, 'bank.csv', '/dev/null', 'csv', 1, md5(random()::text), 'other', 'completed', 'EUR')
         RETURNING id`,
        [owner.userId, owner.workspaceId],
      )
    )[0].id as string;
  const row = async (statementId: string, duplicateOf: string | null) =>
    (
      await dataSource.query(
        `INSERT INTO transactions (transaction_date, counterparty_name, payment_purpose, transaction_type,
           workspace_id, statement_id, amount, debit, currency, is_verified, fingerprint, is_duplicate, duplicate_of_id)
         VALUES ('2026-08-10', 'ACME Store', 'Card payment', 'expense', $1, $2, 25, 25, 'EUR', true,
           $3, $4, $5)
         RETURNING id`,
        [owner.workspaceId, statementId, duplicateOf ? null : 'fp-acme-0810', Boolean(duplicateOf), duplicateOf],
      )
    )[0].id as string;
  const flags = async (id: string) =>
    (await dataSource.query('SELECT is_duplicate, duplicate_of_id FROM transactions WHERE id = $1', [id]))[0];

  beforeAll(async () => {
    const moduleFixture: TestingModule = await e2eTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    dataSource = moduleFixture.get<DataSource>(DataSource);
    owner = await registerAccount(app, email, 'Duplicates Owner');
  });

  afterAll(async () => {
    if (dataSource) {
      await deleteUserByEmail(dataSource, email);
    }
    await app.close();
  });

  it("gives the copies of a deleted statement's row an original: the first, and the rest point to it", async () => {
    const first = await statement();
    const original = await row(first, null);
    const second = await statement();
    const copyA = await row(second, original);
    const copyB = await row(second, original);

    await as(request(app.getHttpServer()).delete(`/statements/${first}?permanent=true`)).expect(204);

    expect(await flags(copyA)).toEqual({ is_duplicate: false, duplicate_of_id: null });
    expect(await flags(copyB)).toEqual({ is_duplicate: true, duplicate_of_id: copyA });
  });
});
