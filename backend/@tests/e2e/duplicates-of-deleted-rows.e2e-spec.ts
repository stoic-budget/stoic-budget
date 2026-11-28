vi.mock('franc', () => ({
  franc: () => 'und',
}));

import { randomUUID } from 'node:crypto';
import { type INestApplication, ValidationPipe } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { AuditAction, AuditEvent, EntityType } from '../../src/entities/audit-event.entity';
import { Transaction } from '../../src/entities/transaction.entity';
import { deleteKeepingSplits } from '../../src/modules/loans/loan-interest-carry';
import { AuditService } from '../../src/modules/audit/audit.service';
import {
  deleteUserByEmail,
  type E2eAccount,
  e2eTestingModule,
  registerAccount,
} from './helpers/e2e-app';

/**
 * A copy flagged as the duplicate of a row that goes keeps an original. A copy
 * found by fingerprint has its original's fingerprint, which the unique index
 * allows on one counted row only: the shape most cases here use.
 */
describe('Duplicates of deleted rows (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  const email = `dup-deleted-${Date.now()}@example.com`;
  let owner: E2eAccount;

  const as = (req: request.Test) =>
    req.set('Authorization', `Bearer ${owner.token}`).set('x-workspace-id', owner.workspaceId);

  const statement = async (trashed = false) =>
    (
      await dataSource.query(
        `INSERT INTO statements (user_id, workspace_id, file_name, file_path, file_type, file_size,
           file_hash, bank_name, status, currency, deleted_at)
         VALUES ($1, $2, 'bank.csv', '/dev/null', 'csv', 1, md5(random()::text), 'other', 'completed', 'EUR', $3)
         RETURNING id`,
        [owner.userId, owner.workspaceId, trashed ? new Date() : null],
      )
    )[0].id as string;
  const row = async (
    statementId: string,
    fingerprint: string | null,
    duplicateOf: string | null,
    date = '2026-08-10',
  ) =>
    (
      await dataSource.query(
        `INSERT INTO transactions (transaction_date, counterparty_name, payment_purpose, transaction_type,
           workspace_id, statement_id, amount, debit, currency, is_verified, fingerprint, is_duplicate, duplicate_of_id)
         VALUES ($1, 'ACME Store', 'Card payment', 'expense', $2, $3, 25, 25, 'EUR', true, $4, $5, $6)
         RETURNING id`,
        [date, owner.workspaceId, statementId, fingerprint, Boolean(duplicateOf), duplicateOf],
      )
    )[0].id as string;
  const flags = async (id: string) =>
    (
      await dataSource.query(
        'SELECT is_duplicate, duplicate_of_id, fingerprint FROM transactions WHERE id = $1',
        [id],
      )
    )[0];
  const fp = () => `fp-${randomUUID()}`;

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

  it("gives the copies of a deleted statement's row an original: the earliest, with its fingerprint", async () => {
    const f = fp();
    const first = await statement();
    const original = await row(first, f, null);
    const second = await statement();
    const later = await row(second, f, original, '2026-08-11');
    const earliest = await row(second, f, original, '2026-08-10');

    await as(request(app.getHttpServer()).delete(`/statements/${first}?permanent=true`)).expect(204);

    expect(await flags(earliest)).toEqual({ is_duplicate: false, duplicate_of_id: null, fingerprint: f });
    expect(await flags(later)).toMatchObject({ is_duplicate: true, duplicate_of_id: earliest });
  });

  it('does not make a copy in the trash the original while a visible one exists', async () => {
    const f = fp();
    const original = await row(await statement(), f, null);
    const inTrash = await row(await statement(true), f, original, '2026-08-01');
    const visible = await row(await statement(), f, original, '2026-08-05');

    await deleteKeepingSplits(dataSource.getRepository(Transaction), owner.workspaceId, {
      id: original,
    });

    expect(await flags(visible)).toMatchObject({ is_duplicate: false, duplicate_of_id: null });
    expect(await flags(inTrash)).toMatchObject({ is_duplicate: true, duplicate_of_id: visible });
  });

  it('points the copies to a counted row that already has their fingerprint', async () => {
    const theirs = fp();
    const original = await row(await statement(), fp(), null);
    const live = await row(await statement(), theirs, null);
    const copy = await row(await statement(), theirs, original);

    await deleteKeepingSplits(dataSource.getRepository(Transaction), owner.workspaceId, {
      id: original,
    });

    expect(await flags(copy)).toMatchObject({ is_duplicate: true, duplicate_of_id: live });
  });

  it('releases the other leg of a transfer whose row goes with its statement', async () => {
    const first = await statement();
    const leg = await row(first, fp(), null);
    const other = await row(await statement(), fp(), null);
    const pair = randomUUID();
    await dataSource.query(
      'UPDATE transactions SET transfer_pair_id = $1 WHERE id = ANY($2::uuid[])',
      [pair, [leg, other]],
    );

    await as(request(app.getHttpServer()).delete(`/statements/${first}?permanent=true`)).expect(204);

    const [left] = await dataSource.query(
      'SELECT transfer_pair_id FROM transactions WHERE id = $1',
      [other],
    );
    expect(left.transfer_pair_id).toBeNull();
  });

  it('deletes a row with two copies, and its undo flags both copies to it again', async () => {
    const f = fp();
    const original = await row(await statement(), f, null);
    const second = await statement();
    const a = await row(second, f, original, '2026-08-10');
    const b = await row(second, f, original, '2026-08-11');

    await as(request(app.getHttpServer()).delete(`/transactions/${original}`)).expect(204);
    expect(await flags(a)).toMatchObject({ is_duplicate: false, fingerprint: f });

    const event = await dataSource.getRepository(AuditEvent).findOneOrFail({
      where: { entityType: EntityType.TRANSACTION, action: AuditAction.DELETE, entityId: original },
      order: { createdAt: 'DESC' },
    });
    const undone = await app.get(AuditService).rollback(event.id, owner.userId, owner.workspaceId);
    expect(undone).toMatchObject({ success: true });

    expect(await flags(original)).toEqual({ is_duplicate: false, duplicate_of_id: null, fingerprint: f });
    expect(await flags(a)).toEqual({ is_duplicate: true, duplicate_of_id: original, fingerprint: f });
    expect(await flags(b)).toMatchObject({ is_duplicate: true, duplicate_of_id: original });
  });
});
