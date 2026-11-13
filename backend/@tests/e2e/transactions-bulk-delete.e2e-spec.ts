vi.mock('franc', () => ({
  franc: () => 'und',
}));

import { randomUUID } from 'node:crypto';
import { type INestApplication, ValidationPipe } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { DataSource, In, type QueryRunner } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { AuditAction, AuditEvent, EntityType } from '../../src/entities/audit-event.entity';
import { Transaction, TransferPairSource } from '../../src/entities/transaction.entity';
import { AuditService } from '../../src/modules/audit/audit.service';
import { lockSplitGroup } from '../../src/modules/transactions/helpers/split-group-lock';
import { lockDeleteClosure } from '../../src/modules/transactions/helpers/transaction-delete-links';
import {
  deleteUserByEmail,
  type E2eAccount,
  e2eTestingModule,
  registerAccount,
} from './helpers/e2e-app';

/**
 * Deleting many rows at once is a run of single deletes, all or nothing: what
 * DELETE /transactions/:id does to what hangs on a row (the audit trail, the
 * other transfer leg, a duplicate, a split sibling), the bulk route does to
 * each row, and one id that is not the workspace's refuses the whole list.
 */
describe('Transactions bulk delete (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  const stamp = Date.now();
  const emails = {
    owner: `bulk-del-owner-${stamp}@example.com`,
    viewer: `bulk-del-viewer-${stamp}@example.com`,
    other: `bulk-del-other-${stamp}@example.com`,
  };
  let owner: E2eAccount;
  let viewer: E2eAccount;
  let other: E2eAccount;
  const categoryOf: Record<string, string> = {};

  const server = () => app.getHttpServer();
  const as = (account: E2eAccount, req: request.Test, workspaceId = owner.workspaceId) =>
    req.set('Authorization', `Bearer ${account.token}`).set('x-workspace-id', workspaceId);
  const bulkDelete = (ids: string[], account = owner) =>
    as(account, request(server()).post('/transactions/bulk-delete')).send({ ids });
  const rows = () => dataSource.getRepository(Transaction);

  async function book(merchant: string, account = owner, amount = '20.00'): Promise<string> {
    const workspaceId = account.workspaceId;
    const statement = await as(account, request(server()).post('/statements/manual-expense'), workspaceId)
      .field('amount', amount)
      .field('currency', 'USD')
      .field('merchant', merchant)
      .field('categoryId', categoryOf[account.email])
      .field('date', '2026-06-03')
      .expect(201);
    const row = await rows().findOneByOrFail({ statementId: statement.body.id });
    return row.id;
  }

  async function pair(a: string, b: string): Promise<string> {
    const transferPairId = randomUUID();
    await rows().update(
      { id: In([a, b]) },
      { transferPairId, transferPairSource: TransferPairSource.MANUAL },
    );
    return transferPairId;
  }

  async function deleteEvents(ids: string[]): Promise<AuditEvent[]> {
    return dataSource.getRepository(AuditEvent).find({
      where: { entityType: EntityType.TRANSACTION, action: AuditAction.DELETE, entityId: In(ids) },
    });
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await e2eTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    dataSource = moduleFixture.get(DataSource);

    owner = await registerAccount(app, emails.owner, 'Member One');
    viewer = await registerAccount(app, emails.viewer, 'Member Two');
    other = await registerAccount(app, emails.other, 'Member Three');
    const invite = await as(
      owner,
      request(server()).post(`/workspaces/${owner.workspaceId}/invitations`),
    )
      .send({ email: viewer.email, role: 'viewer' })
      .expect(201);
    await request(server())
      .post(`/workspaces/invitations/${invite.body.invitation.token}/accept`)
      .set('Authorization', `Bearer ${viewer.token}`)
      .expect(200);

    for (const account of [owner, other]) {
      const categories = await as(
        account,
        request(server()).get('/categories?type=expense'),
        account.workspaceId,
      ).expect(200);
      categoryOf[account.email] = categories.body[0].id;
    }
  });

  afterAll(async () => {
    if (dataSource) {
      for (const email of Object.values(emails)) {
        await deleteUserByEmail(dataSource, email);
      }
    }
    await app.close();
  });

  it('a single delete releases the other transfer leg and leaves an undoable audit entry', async () => {
    const outgoing = await book('ACME Store - Savings move');
    const incoming = await book('ACME Store - Savings arrive');
    await pair(outgoing, incoming);

    await as(owner, request(server()).delete(`/transactions/${outgoing}`)).expect(204);

    expect(await rows().findOneBy({ id: outgoing })).toBeNull();
    expect(await rows().findOneByOrFail({ id: incoming })).toMatchObject({
      transferPairId: null,
      transferPairSource: null,
    });
    const [event] = await deleteEvents([outgoing]);
    expect(event).toMatchObject({ isUndoable: true, batchId: null });
  });

  it('deletes many rows with the same side effects, as one undoable batch', async () => {
    const outgoing = await book('ACME Store - Transfer out');
    const outgoingStatementId = (await rows().findOneByOrFail({ id: outgoing })).statementId;
    const incoming = await book('ACME Store - Transfer in');
    await pair(outgoing, incoming);

    const master = await book('ACME Store - Wireless Buds');
    const duplicate = await book('ACME Store - Wireless Buds (copy)');
    await rows().update(duplicate, { isDuplicate: true, duplicateOfId: master });

    const whole = await book('ACME Store - Groceries', owner, '30.00');
    await as(owner, request(server()).post(`/transactions/${whole}/split`))
      .send({ parts: [{ amount: 10 }, { amount: 20 }] })
      .expect(200);
    const parts = await rows().find({
      where: { splitGroupId: (await rows().findOneByOrFail({ id: whole })).splitGroupId ?? '' },
      order: { splitIndex: 'ASC' },
    });
    expect(parts).toHaveLength(2);
    const [kept, removedPart] = parts;

    const res = await bulkDelete([outgoing, master, removedPart.id, outgoing]).expect(200);
    expect(res.body).toEqual({ deleted: 3 });

    expect(await rows().countBy({ id: In([outgoing, master, removedPart.id]) })).toBe(0);
    // The statement of a deleted row no longer counts it.
    const [statement] = await dataSource.query(
      'SELECT total_transactions, total_debit FROM statements WHERE id = $1',
      [outgoingStatementId],
    );
    expect(statement).toEqual({ total_transactions: 0, total_debit: '0.00' });
    // The other transfer leg counts again: there is no transfer left.
    expect(await rows().findOneByOrFail({ id: incoming })).toMatchObject({ transferPairId: null });
    // The copy of a deleted master is the only record of the charge now.
    expect(await rows().findOneByOrFail({ id: duplicate })).toMatchObject({
      isDuplicate: false,
      duplicateOfId: null,
    });
    // The last part of a split is a plain row again.
    expect(await rows().findOneByOrFail({ id: kept.id })).toMatchObject({
      splitGroupId: null,
      splitIndex: null,
    });

    const events = await deleteEvents([outgoing, master, removedPart.id]);
    expect(events).toHaveLength(3);
    expect(new Set(events.map(event => event.batchId)).size).toBe(1);
    expect(events[0].batchId).not.toBeNull();
    expect(events.every(event => event.isUndoable)).toBe(true);

    // Undo brings a row back from its snapshot, as after a single delete. The
    // route is for instance admins, so the service is called directly.
    const masterEvent = events.find(event => event.entityId === master);
    await app.get(AuditService).rollback(masterEvent?.id ?? '', owner.userId, owner.workspaceId);
    expect(await rows().findOneBy({ id: master })).not.toBeNull();
  });

  it("refuses another workspace's id without deleting anything or saying it exists", async () => {
    const mine = await book('ACME Store - Desk lamp');
    const theirs = await book('ACME Store - Desk chair', other);

    const foreign = await bulkDelete([mine, theirs]).expect(404);
    const unknown = await bulkDelete([mine, randomUUID()]).expect(404);
    expect(foreign.body.error?.code ?? foreign.body.code).toBe(
      unknown.body.error?.code ?? unknown.body.code,
    );
    expect(foreign.body.message).toBe(unknown.body.message);

    expect(await rows().countBy({ id: In([mine, theirs]) })).toBe(2);
  });

  it('refuses a viewer and leaves the rows', async () => {
    const id = await book('ACME Store - Notebook');
    await bulkDelete([id], viewer).expect(403);
    expect(await rows().findOneBy({ id })).not.toBeNull();
  });

  it('refuses an empty list, a list over 1000 and an id that is not one', async () => {
    await bulkDelete([]).expect(400);
    await bulkDelete(Array.from({ length: 1001 }, () => randomUUID())).expect(400);
    await bulkDelete(['not-an-id']).expect(400);
  });

  it('refuses the whole list when one row is on a filed tax return', async () => {
    const free = await book('ACME Store - Pens');
    const filed = await book('ACME Store - Printer');
    await rows().update(filed, { taxLocked: true, taxAmount: 0 });

    await bulkDelete([free, filed]).expect(409);
    expect(await rows().countBy({ id: In([free, filed]) })).toBe(2);
  });

  it('the same request twice at once deletes once and answers the other cleanly', async () => {
    const ids = [await book('ACME Store - Cable'), await book('ACME Store - Charger')];

    const answers = await Promise.all([bulkDelete(ids), bulkDelete(ids)]);
    const statuses = answers.map(res => res.status).sort();
    expect(statuses).toEqual([200, 404]);
    expect(answers.find(res => res.status === 200)?.body).toEqual({ deleted: 2 });

    expect(await rows().countBy({ id: In(ids) })).toBe(0);
    expect(await deleteEvents(ids)).toHaveLength(2);
  });

  it('both halves of a transfer deleted at once: both go, no deadlock', async () => {
    for (let round = 0; round < 5; round++) {
      const a = await book(`ACME Store - Move out ${round}`);
      const b = await book(`ACME Store - Move in ${round}`);
      await pair(a, b);

      const answers = await Promise.all([
        as(owner, request(server()).delete(`/transactions/${a}`)),
        as(owner, request(server()).delete(`/transactions/${b}`)),
      ]);
      expect(answers.map(res => res.status)).toEqual([204, 204]);
      expect(await rows().countBy({ id: In([a, b]) })).toBe(0);
    }
  });

  it("two bulk deletes holding each other's transfer partners both finish", async () => {
    for (let round = 0; round < 5; round++) {
      const a1 = await book(`ACME Store - Leg A1 ${round}`);
      const b1 = await book(`ACME Store - Leg B1 ${round}`);
      const a2 = await book(`ACME Store - Leg A2 ${round}`);
      const b2 = await book(`ACME Store - Leg B2 ${round}`);
      await pair(a1, b1);
      await pair(a2, b2);

      const answers = await Promise.all([bulkDelete([a1, b2]), bulkDelete([a2, b1])]);
      expect(answers.map(res => res.status)).toEqual([200, 200]);
      expect(await rows().countBy({ id: In([a1, b1, a2, b2]) })).toBe(0);
    }
  });

  it("recounts a split statement from its rows instead of subtracting", async () => {
    const whole = await book('ACME Store - Hardware', owner, '30.00');
    const { statementId } = await rows().findOneByOrFail({ id: whole });
    await as(owner, request(server()).post(`/transactions/${whole}/split`))
      .send({ parts: [{ amount: 10 }, { amount: 10.1 }, { amount: 9.9 }] })
      .expect(200);
    const parts = await rows().find({ where: { statementId: statementId ?? '' } });
    expect(parts).toHaveLength(3);

    await bulkDelete([parts[0].id]).expect(200);

    const [statement] = await dataSource.query(
      'SELECT total_transactions, total_debit FROM statements WHERE id = $1',
      [statementId],
    );
    const left = await rows().find({ where: { statementId: statementId ?? '' } });
    expect(statement.total_transactions).toBe(2);
    const cents = left.reduce((sum, row) => sum + Math.round(Number(row.debit) * 100), 0);
    expect(statement.total_debit).toBe((cents / 100).toFixed(2));
    // Still listed as a statement with rows.
    const listed = await as(owner, request(server()).get('/statements?has=transactions&limit=100'));
    expect(JSON.stringify(listed.body)).toContain(statementId);
  });

  /** A statement imported from a table, as the import counts it: repeats flagged, still counted. */
  async function importTable(name: string, amounts: number[]): Promise<string> {
    const post = (url: string, body: object) =>
      as(owner, request(server()).post(url)).send(body).expect(201);
    const tableId = (await post('/custom-tables', { name })).body.id;
    const keys: Record<string, string> = {};
    for (const [title, type] of [
      ['Date', 'date'],
      ['Amount', 'number'],
      ['Vendor', 'text'],
    ]) {
      keys[title] = (await post(`/custom-tables/${tableId}/columns`, { title, type })).body.key;
    }
    for (const amount of amounts) {
      await post(`/custom-tables/${tableId}/rows`, {
        data: { [keys.Date]: '2026-10-01', [keys.Amount]: amount, [keys.Vendor]: 'ACME Store' },
      });
    }
    const converted = await as(
      owner,
      request(server()).post(`/custom-tables/${tableId}/convert-to-statement`),
    );
    expect(converted.status).toBeLessThan(300);
    return converted.body.statementId;
  }
  const totalsOf = async (statementId: string) =>
    (
      await dataSource.query(
        'SELECT total_transactions, total_debit FROM statements WHERE id = $1',
        [statementId],
      )
    )[0];

  it('a delete recounts by the import rule: a flagged repeat stays counted', async () => {
    const statementId = await importTable('Shop costs', [30, 30, 120.5]);
    const imported = await rows().find({ where: { statementId } });
    expect(imported.filter(r => r.isDuplicate)).toHaveLength(1);
    expect(await totalsOf(statementId)).toEqual({ total_transactions: 3, total_debit: '180.50' });

    const big = imported.find(r => Number(r.amount) === 120.5);
    await bulkDelete([big?.id ?? '']).expect(200);
    expect(await totalsOf(statementId)).toEqual({ total_transactions: 2, total_debit: '60.00' });

    // Recheck keeps its own rule, rows that are not suspected duplicates.
    await as(owner, request(server()).post(`/statements/${statementId}/recheck`)).expect(
      (res: request.Response) => expect(res.status).toBeLessThan(300),
    );
    expect(await totalsOf(statementId)).toEqual({ total_transactions: 1, total_debit: '30.00' });
  });

  it('a statement whose rows are all flagged repeats stays listed after a delete', async () => {
    await importTable('First import', [55, 56]);
    const statementId = await importTable('Second import', [55, 56]);
    const imported = await rows().find({ where: { statementId } });
    expect(imported.every(r => r.isDuplicate)).toBe(true);

    await bulkDelete([imported[0].id]).expect(200);
    expect((await totalsOf(statementId)).total_transactions).toBe(1);
    const listed = await as(owner, request(server()).get('/statements?has=transactions&limit=100'));
    expect(JSON.stringify(listed.body)).toContain(statementId);
  });

  it('a delete and an unsplit of the same group lock in one order', async () => {
    let deadlocks = 0;
    for (let round = 0; round < 20; round++) {
      const whole = await book(`ACME Store - Lock order ${round}`);
      await as(owner, request(server()).post(`/transactions/${whole}/split`))
        .send({ parts: [{ amount: 10 }, { amount: 10 }] })
        .expect(200);
      const groupId = (await rows().findOneByOrFail({ id: whole })).splitGroupId ?? '';
      const parts = await rows().find({ where: { splitGroupId: groupId } });
      for (let attempt = 0; attempt < 25; attempt++) {
        const runners = [dataSource.createQueryRunner(), dataSource.createQueryRunner()];
        for (const runner of runners) {
          await runner.connect();
          await runner.startTransaction();
        }
        const [deleting, unsplitting] = runners;
        // Each side lets go as soon as it holds its locks, so the other can finish.
        const holdThenRelease = async (runner: QueryRunner, work: () => Promise<unknown>) => {
          try {
            await work();
          } finally {
            await runner.rollbackTransaction().catch(() => undefined);
          }
        };
        const settled = await Promise.allSettled([
          holdThenRelease(deleting, () =>
            lockDeleteClosure(deleting.manager, owner.workspaceId, [parts[0].id]),
          ),
          holdThenRelease(unsplitting, () =>
            lockSplitGroup(
              unsplitting.manager.getRepository(Transaction),
              owner.workspaceId,
              groupId,
            ),
          ),
        ]);
        for (const runner of runners) {
          await runner.release();
        }
        deadlocks += settled.filter(
          result => result.status === 'rejected' && String(result.reason).includes('deadlock'),
        ).length;
      }
    }
    expect(deadlocks).toBe(0);
  }, 300_000);

  it("names a deleted row to the household, but never a member's private one", async () => {
    // Notices arrive through an async listener: wait for the one asked about.
    const labels = async (where: string): Promise<Array<string | null>> => {
      for (let attempt = 0; attempt < 30; attempt++) {
        const found: Array<{ label: string | null }> = await dataSource.query(
          `SELECT meta->>'entityLabel' AS label FROM notifications
           WHERE workspace_id = $1 AND type = 'data.deleted' AND recipient_id = $2 AND ${where}`,
          [owner.workspaceId, viewer.userId],
        );
        if (found.length > 0) return found.map(row => row.label);
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      return [];
    };

    const shared = await book('ACME Store - Shared lamp');
    await bulkDelete([shared]).expect(200);
    expect(await labels(`meta->>'entityLabel' = 'ACME Store - Shared lamp'`)).toHaveLength(1);

    const hidden = await book('ACME Store - Hidden gift');
    const [membership] = await dataSource.query(
      'SELECT id FROM workspace_members WHERE workspace_id = $1 AND user_id = $2',
      [owner.workspaceId, viewer.userId],
    );
    await rows().update(hidden, { isPrivate: true, ownerMemberId: membership.id });
    await bulkDelete([hidden]).expect(200);
    expect(await labels(`meta->>'count' = '1' AND meta->>'entityLabel' IS NULL`)).toHaveLength(1);
    expect(await dataSource.query(
      `SELECT 1 FROM notifications WHERE recipient_id = $1 AND meta::text LIKE '%Hidden gift%'`,
      [viewer.userId],
    )).toHaveLength(0);
  });
});
