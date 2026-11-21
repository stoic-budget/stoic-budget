vi.mock('franc', () => ({
  franc: () => 'und',
}));

import { randomUUID } from 'node:crypto';
import { type INestApplication, ValidationPipe } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { DataSource, In } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { AuditAction, AuditEvent, EntityType } from '../../src/entities/audit-event.entity';
import { Transaction, TransferPairSource } from '../../src/entities/transaction.entity';
import { AuditService } from '../../src/modules/audit/audit.service';
import {
  deleteUserByEmail,
  type E2eAccount,
  e2eTestingModule,
  registerAccount,
} from './helpers/e2e-app';

/**
 * Undoing a delete puts back what the delete took apart around the row: the
 * transfer pair, the duplicate flag on its copy, the split, the statement's
 * totals. A link that can no longer be restored is dropped, so a row never
 * comes back hidden with nobody to explain it.
 */
describe('Transactions delete undo (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  const stamp = Date.now();
  const email = `delete-undo-${stamp}@example.com`;
  let owner: E2eAccount;
  let categoryId: string;

  const server = () => app.getHttpServer();
  const as = (req: request.Test) =>
    req.set('Authorization', `Bearer ${owner.token}`).set('x-workspace-id', owner.workspaceId);
  const rows = () => dataSource.getRepository(Transaction);
  const row = (id: string) => rows().findOneByOrFail({ id });

  async function book(merchant: string, amount = '20.00'): Promise<string> {
    const statement = await as(request(server()).post('/statements/manual-expense'))
      .field('amount', amount)
      .field('currency', 'USD')
      .field('merchant', merchant)
      .field('categoryId', categoryId)
      .field('date', '2026-07-03')
      .expect(201);
    return (await rows().findOneByOrFail({ statementId: statement.body.id })).id;
  }

  async function pair(a: string, b: string): Promise<string> {
    const transferPairId = randomUUID();
    await rows().update(
      { id: In([a, b]) },
      { transferPairId, transferPairSource: TransferPairSource.MANUAL },
    );
    return transferPairId;
  }

  async function undo(id: string): Promise<void> {
    const event = await dataSource.getRepository(AuditEvent).findOneOrFail({
      where: { entityType: EntityType.TRANSACTION, action: AuditAction.DELETE, entityId: id },
      order: { createdAt: 'DESC' },
    });
    const result = await app.get(AuditService).rollback(event.id, owner.userId, owner.workspaceId);
    expect(result).toMatchObject({ success: true });
  }

  async function statementTotals(statementId: string | null) {
    const [statement] = await dataSource.query(
      'SELECT total_transactions, total_debit FROM statements WHERE id = $1',
      [statementId],
    );
    return statement;
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await e2eTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    dataSource = moduleFixture.get(DataSource);
    owner = await registerAccount(app, email, 'Member One');
    categoryId = (await as(request(server()).get('/categories?type=expense')).expect(200)).body[0]
      .id;
  });

  afterAll(async () => {
    if (dataSource) {
      await deleteUserByEmail(dataSource, email);
    }
    await app.close();
  });

  it('undoing a deleted transfer leg pairs it again with the leg it left', async () => {
    const out = await book('ACME Store - Undo out');
    const into = await book('ACME Store - Undo in');
    const pairId = await pair(out, into);

    await as(request(server()).delete(`/transactions/${out}`)).expect(204);
    expect((await row(into)).transferPairId).toBeNull();

    await undo(out);
    expect(await row(out)).toMatchObject({ transferPairId: pairId });
    expect(await row(into)).toMatchObject({
      transferPairId: pairId,
      transferPairSource: TransferPairSource.MANUAL,
    });
  });

  it('a leg whose partner was paired elsewhere meanwhile comes back unpaired', async () => {
    const out = await book('ACME Store - Repaired out');
    const into = await book('ACME Store - Repaired in');
    const other = await book('ACME Store - Repaired other');
    await pair(out, into);

    await as(request(server()).delete(`/transactions/${out}`)).expect(204);
    const newPair = await pair(into, other);

    await undo(out);
    expect(await row(out)).toMatchObject({ transferPairId: null });
    expect(await row(into)).toMatchObject({ transferPairId: newPair });
  });

  it('both legs deleted together come back as a pair once both are undone', async () => {
    const out = await book('ACME Store - Both out');
    const into = await book('ACME Store - Both in');
    const pairId = await pair(out, into);
    await as(request(server()).post('/transactions/bulk-delete'))
      .send({ ids: [out, into] })
      .expect(200);

    await undo(out);
    // Alone it is no transfer: it counts until its partner is back.
    expect(await row(out)).toMatchObject({ transferPairId: null });
    await undo(into);
    expect(await row(out)).toMatchObject({ transferPairId: pairId });
    expect(await row(into)).toMatchObject({ transferPairId: pairId });
  });

  it('undoing a deleted master flags its copy again, so the charge counts once', async () => {
    const master = await book('ACME Store - Undo master');
    const copy = await book('ACME Store - Undo copy');
    await rows().update(copy, {
      isDuplicate: true,
      duplicateOfId: master,
      duplicateConfidence: 0.95,
      duplicateMatchType: 'exact',
    });

    await as(request(server()).delete(`/transactions/${master}`)).expect(204);
    expect(await row(copy)).toMatchObject({ isDuplicate: false, duplicateOfId: null });

    await undo(master);
    expect(await row(copy)).toMatchObject({
      isDuplicate: true,
      duplicateOfId: master,
      duplicateMatchType: 'exact',
    });
    expect(Number((await row(copy)).duplicateConfidence)).toBe(0.95);
  });

  it('a copy deleted with its master and undone first comes back unflagged, then flagged', async () => {
    const master = await book('ACME Store - Pair master');
    const copy = await book('ACME Store - Pair copy');
    await rows().update(copy, { isDuplicate: true, duplicateOfId: master });
    await as(request(server()).post('/transactions/bulk-delete'))
      .send({ ids: [master, copy] })
      .expect(200);

    // Its master is not back yet: flagged, the charge would count nowhere.
    await undo(copy);
    expect(await row(copy)).toMatchObject({ isDuplicate: false, duplicateOfId: null });
    await undo(master);
    expect(await row(copy)).toMatchObject({ isDuplicate: true, duplicateOfId: master });
  });

  it('undoing a deleted split part rejoins the part left behind', async () => {
    const whole = await book('ACME Store - Undo split', '30.00');
    const { statementId } = await row(whole);
    await as(request(server()).post(`/transactions/${whole}/split`))
      .send({ parts: [{ amount: 12.5 }, { amount: 17.5 }] })
      .expect(200);
    const [kept, gone] = await rows().find({
      where: { statementId: statementId ?? '' },
      order: { splitIndex: 'ASC' },
    });
    const groupId = kept.splitGroupId;

    await as(request(server()).delete(`/transactions/${gone.id}`)).expect(204);
    expect(await row(kept.id)).toMatchObject({ splitGroupId: null });
    expect(await statementTotals(statementId)).toEqual({
      total_transactions: 1,
      total_debit: '12.50',
    });

    await undo(gone.id);
    expect(await row(kept.id)).toMatchObject({ splitGroupId: groupId, splitIndex: 0 });
    expect(await row(gone.id)).toMatchObject({ splitGroupId: groupId, splitIndex: 1 });
    expect(await statementTotals(statementId)).toEqual({
      total_transactions: 2,
      total_debit: '30.00',
    });
  });

  it('a copy split after its master was deleted is not flagged again by the undo', async () => {
    const master = await book('ACME Store - Split copy master');
    const copy = await book('ACME Store - Split copy');
    await rows().update(copy, { isDuplicate: true, duplicateOfId: master });
    await as(request(server()).delete(`/transactions/${master}`)).expect(204);
    await as(request(server()).post(`/transactions/${copy}/split`))
      .send({ parts: [{ amount: 10 }, { amount: 10 }] })
      .expect(200);

    await undo(master);
    const groupId = (await row(copy)).splitGroupId ?? '';
    const parts = await rows().find({ where: { splitGroupId: groupId } });
    expect(parts.every(part => !part.isDuplicate)).toBe(true);
    // The parts can still be put back together.
    await as(request(server()).post(`/transactions/${copy}/unsplit`)).expect(200);
  });

  it('a partner split after the delete is not paired again by the undo', async () => {
    const out = await book('ACME Store - Split partner out');
    const into = await book('ACME Store - Split partner in');
    await pair(out, into);
    await as(request(server()).delete(`/transactions/${out}`)).expect(204);
    await as(request(server()).post(`/transactions/${into}/split`))
      .send({ parts: [{ amount: 5 }, { amount: 15 }] })
      .expect(200);

    await undo(out);
    expect(await row(out)).toMatchObject({ transferPairId: null });
    const groupId = (await row(into)).splitGroupId ?? '';
    const parts = await rows().find({ where: { splitGroupId: groupId } });
    expect(parts.every(part => part.transferPairId === null)).toBe(true);
  });

  it('an undo and a delete of its partner at the same time both finish', async () => {
    for (let round = 0; round < 15; round++) {
      const out = await book(`ACME Store - Race out ${round}`);
      const into = await book(`ACME Store - Race in ${round}`);
      // Both legs on one statement, so the undo and the delete meet on it too.
      const { statementId } = await row(out);
      await rows().update(into, { statementId });
      await pair(out, into);
      await as(request(server()).delete(`/transactions/${out}`)).expect(204);

      const event = await dataSource.getRepository(AuditEvent).findOneOrFail({
        where: { entityType: EntityType.TRANSACTION, action: AuditAction.DELETE, entityId: out },
      });
      const [undone, deleted] = await Promise.all([
        app.get(AuditService).rollback(event.id, owner.userId, owner.workspaceId),
        as(request(server()).delete(`/transactions/${into}`)),
      ]);
      expect(undone).toMatchObject({ success: true });
      expect(deleted.status).toBe(204);
      expect(await row(out)).toMatchObject({ transferPairId: null });
      const left = await rows().countBy({ statementId: statementId ?? '' });
      expect(await statementTotals(statementId)).toMatchObject({ total_transactions: left });
    }
  });

  it('undo puts the statement totals back', async () => {
    const id = await book('ACME Store - Undo totals', '42.10');
    const { statementId } = await row(id);
    await as(request(server()).post('/transactions/bulk-delete')).send({ ids: [id] }).expect(200);
    expect(await statementTotals(statementId)).toEqual({
      total_transactions: 0,
      total_debit: '0.00',
    });

    await undo(id);
    expect(await statementTotals(statementId)).toEqual({
      total_transactions: 1,
      total_debit: '42.10',
    });
  });
});
