vi.mock('franc', () => ({
  franc: () => 'und',
}));

import { type INestApplication, ValidationPipe } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { NOTE_SEPARATOR } from '../../src/modules/transactions/helpers/bulk-annotate-plan';
import {
  deleteUserByEmail,
  type E2eAccount,
  e2eTestingModule,
  registerAccount,
} from './helpers/e2e-app';

/**
 * `POST /transactions/bulk-annotate`: tags and a comment for the ticked rows.
 * Additive, all-or-nothing, workspace-scoped, idempotent under a double click.
 */
describe('Bulk tags and comment (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  const stamp = Date.now();
  const emails = {
    owner: `bulk-owner-${stamp}@example.com`,
    partner: `bulk-partner-${stamp}@example.com`,
    viewer: `bulk-viewer-${stamp}@example.com`,
    outsider: `bulk-outsider-${stamp}@example.com`,
  };
  let owner: E2eAccount;
  let partner: E2eAccount;
  let viewer: E2eAccount;
  let outsider: E2eAccount;
  const rows: string[] = [];
  let outsiderRow: string;
  let outsiderTag: string;

  const server = () => app.getHttpServer();
  const as = (account: E2eAccount, req: request.Test, workspaceId = owner.workspaceId) =>
    req.set('Authorization', `Bearer ${account.token}`).set('x-workspace-id', workspaceId);
  const annotate = (account: E2eAccount, body: Record<string, unknown>) =>
    as(account, request(server()).post('/transactions/bulk-annotate')).send(body);

  async function bookExpense(account: E2eAccount, merchant: string): Promise<string> {
    const categories = await as(
      account,
      request(server()).get('/categories?type=expense'),
      account.workspaceId,
    ).expect(200);
    const statement = await as(
      account,
      request(server()).post('/statements/manual-expense'),
      account.workspaceId,
    )
      .field('amount', '12')
      .field('currency', 'EUR')
      .field('merchant', merchant)
      .field('categoryId', categories.body[0].id)
      .field('date', '2026-11-02')
      .expect(201);
    const listed = await as(
      account,
      request(server()).get(`/transactions?statementId=${statement.body.id}`),
      account.workspaceId,
    ).expect(200);
    return listed.body.data[0].id;
  }

  const createTag = async (account: E2eAccount, name: string): Promise<string> =>
    (
      await as(account, request(server()).post('/tags'), account.workspaceId)
        .send({ name })
        .expect(201)
    ).body.id;

  const tagsOf = async (id: string): Promise<string[]> =>
    (
      await dataSource.query(
        'SELECT tag_id FROM transaction_tags WHERE transaction_id = $1 ORDER BY tag_id',
        [id],
      )
    ).map((row: { tag_id: string }) => row.tag_id);

  const commentOf = async (id: string): Promise<string | null> =>
    (await dataSource.query('SELECT comments FROM transactions WHERE id = $1', [id]))[0].comments;

  const auditCount = async (): Promise<number> =>
    Number(
      (
        await dataSource.query(
          `SELECT count(*) AS n FROM audit_events
           WHERE workspace_id = $1 AND meta->>'bulk' = 'annotate'`,
          [owner.workspaceId],
        )
      )[0].n,
    );

  async function invite(account: E2eAccount, role: string): Promise<void> {
    const sent = await as(
      owner,
      request(server()).post(`/workspaces/${owner.workspaceId}/invitations`),
    )
      .send({ email: account.email, role, permissions: { canEditStatements: true } })
      .expect(201);
    await request(server())
      .post(`/workspaces/invitations/${sent.body.invitation.token}/accept`)
      .set('Authorization', `Bearer ${account.token}`)
      .expect(200);
  }

  async function membershipId(userId: string): Promise<string> {
    const [row] = await dataSource.query(
      'SELECT id FROM workspace_members WHERE workspace_id = $1 AND user_id = $2',
      [owner.workspaceId, userId],
    );
    return row.id;
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await e2eTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    dataSource = moduleFixture.get<DataSource>(DataSource);

    owner = await registerAccount(app, emails.owner, 'Member One');
    partner = await registerAccount(app, emails.partner, 'Member Two');
    viewer = await registerAccount(app, emails.viewer, 'Member Three');
    outsider = await registerAccount(app, emails.outsider, 'Member Four');
    await invite(partner, 'member');
    await invite(viewer, 'viewer');

    for (const merchant of ['ACME Store - Wireless Buds', 'Example Bakery', 'Example Cinema']) {
      rows.push(await bookExpense(owner, merchant));
    }
    outsiderRow = await bookExpense(outsider, 'Example Garage');
    outsiderTag = await createTag(outsider, 'Outsider tag');
  });

  afterAll(async () => {
    if (dataSource) {
      for (const email of Object.values(emails)) {
        await deleteUserByEmail(dataSource, email);
      }
    }
    await app.close();
  });

  it('adds a tag to every row and keeps the tags they had', async () => {
    const kept = await createTag(owner, 'Kept');
    const trip = await createTag(owner, 'Trip');
    await as(owner, request(server()).put(`/transactions/${rows[0]}/tags`))
      .send({ tagIds: [kept] })
      .expect(200);
    const before = await auditCount();

    const res = await annotate(owner, { ids: rows, addTagIds: [trip] }).expect(200);

    expect(res.body).toEqual({ updated: 3, skippedPrivate: 0, skippedTooLong: 0 });
    expect(await tagsOf(rows[0])).toEqual([kept, trip].sort());
    expect(await tagsOf(rows[1])).toEqual([trip]);
    expect(await tagsOf(rows[2])).toEqual([trip]);
    // One undoable entry per row, under one batch.
    const events = await dataSource.query(
      `SELECT batch_id, is_undoable FROM audit_events
       WHERE workspace_id = $1 AND meta->>'bulk' = 'annotate'`,
      [owner.workspaceId],
    );
    expect(events.length - before).toBe(3);
    expect(new Set(events.map((e: { batch_id: string }) => e.batch_id)).size).toBe(1);
    expect(events.every((e: { is_undoable: boolean }) => e.is_undoable)).toBe(true);
  });

  it('treats a tag a row already has as a no-op', async () => {
    const trip = (await tagsOf(rows[1]))[0];
    const before = await auditCount();
    const res = await annotate(owner, { ids: rows, addTagIds: [trip] }).expect(200);
    expect(res.body.updated).toBe(0);
    expect(await tagsOf(rows[1])).toEqual([trip]);
    expect(await auditCount()).toBe(before);
  });

  it('appends the comment after the one a row has', async () => {
    await as(owner, request(server()).put(`/transactions/${rows[0]}`))
      .send({ comments: 'Paid in cash' })
      .expect(200);
    const res = await annotate(owner, { ids: rows, note: '  Holiday  ' }).expect(200);
    expect(res.body.updated).toBe(3);
    expect(await commentOf(rows[0])).toBe(`Paid in cash${NOTE_SEPARATOR}Holiday`);
    expect(await commentOf(rows[1])).toBe('Holiday');

    // The row's History tab shows it as a comment change it can put back.
    const history = await as(owner, request(server()).get(`/transactions/${rows[0]}/history`))
      .expect(200);
    const change = history.body.entries.find(
      (entry: { changes?: Array<{ field: string }> }) =>
        entry.changes?.some(c => c.field === 'comment'),
    );
    expect(change).toBeDefined();
  });

  it('survives the same request twice at once', async () => {
    const twice = await createTag(owner, 'Twice');
    const body = { ids: rows, addTagIds: [twice], note: 'Checked' };
    const before = await auditCount();
    const [first, second] = await Promise.all([annotate(owner, body), annotate(owner, body)]);
    expect([first.status, second.status]).toEqual([200, 200]);
    expect(first.body.updated + second.body.updated).toBe(3);
    for (const id of rows) {
      expect((await tagsOf(id)).filter(tag => tag === twice)).toHaveLength(1);
      expect((await commentOf(id))?.split('Checked')).toHaveLength(2);
    }
    expect((await auditCount()) - before).toBe(3);
  });

  it('refuses another workspace’s tag and changes nothing', async () => {
    const mine = await createTag(owner, 'Mine');
    const tagsBefore = await Promise.all(rows.map(tagsOf));
    const before = await auditCount();
    const res = await annotate(owner, {
      ids: rows,
      addTagIds: [mine, outsiderTag],
      note: 'Should not land',
    }).expect(400);
    expect(res.body.error.code).toBe('TRANSACTION_TAGS_NOT_FOUND');
    expect(JSON.stringify(res.body)).not.toContain('Outsider tag');
    expect(await Promise.all(rows.map(tagsOf))).toEqual(tagsBefore);
    expect(await commentOf(rows[1])).not.toContain('Should not land');
    expect(await auditCount()).toBe(before);
  });

  it('refuses another workspace’s row and changes neither workspace', async () => {
    const mine = await createTag(owner, 'Never');
    const res = await annotate(owner, {
      ids: [rows[1], outsiderRow],
      addTagIds: [mine],
      note: 'Should not land',
    }).expect(404);
    expect(JSON.stringify(res.body)).not.toContain('Example Garage');
    expect(await tagsOf(rows[1])).not.toContain(mine);
    expect(await tagsOf(outsiderRow)).toEqual([]);
    expect(await commentOf(outsiderRow)).toBeNull();
    expect(await commentOf(rows[1])).not.toContain('Should not land');
  });

  it('refuses a viewer', async () => {
    const before = await Promise.all(rows.map(commentOf));
    await annotate(viewer, { ids: rows, note: 'Viewer note' }).expect(403);
    expect(await Promise.all(rows.map(commentOf))).toEqual(before);
  });

  it('refuses a body with neither tags nor a comment', async () => {
    await annotate(owner, { ids: rows, note: '   ' }).expect(400);
    await annotate(owner, { ids: rows, addTagIds: [] }).expect(400);
  });

  it('tags another member’s private row but leaves its comment to its owner', async () => {
    const ownerMemberId = await membershipId(owner.userId);
    const secret = rows[2];
    await as(owner, request(server()).put(`/transactions/${secret}`))
      .send({ ownerMemberId })
      .expect(200);
    await as(owner, request(server()).put(`/transactions/${secret}`))
      .send({ isPrivate: true, comments: 'Anniversary gift' })
      .expect(200);
    const label = await createTag(owner, 'Shared label');

    const res = await annotate(partner, {
      ids: [rows[1], secret],
      addTagIds: [label],
      note: 'Anniversary gift',
    }).expect(200);

    expect(res.body).toEqual({ updated: 2, skippedPrivate: 1, skippedTooLong: 0 });
    expect(await tagsOf(secret)).toContain(label);
    expect(await commentOf(secret)).toBe('Anniversary gift');
    expect(await commentOf(rows[1])).toContain('Anniversary gift');

    // The owner's own private row takes the comment like any other.
    await annotate(owner, { ids: [secret], note: 'Wrapped' }).expect(200);
    expect(await commentOf(secret)).toBe(`Anniversary gift${NOTE_SEPARATOR}Wrapped`);
  });

  /** A fresh row with an earlier tag and comment of its own, so each undo test stands alone. */
  async function freshRow(label: string): Promise<{ id: string; earlier: string }> {
    const id = await bookExpense(owner, `Example Shop - ${label}`);
    const earlier = await createTag(owner, `Earlier ${label}`);
    await as(owner, request(server()).put(`/transactions/${id}/tags`))
      .send({ tagIds: [earlier] })
      .expect(200);
    await as(owner, request(server()).put(`/transactions/${id}`))
      .send({ comments: 'Typed by hand' })
      .expect(200);
    return { id, earlier };
  }

  const latestBulkEvent = async (id: string): Promise<string> =>
    (
      await dataSource.query(
        `SELECT id FROM audit_events WHERE entity_id = $1 AND meta->>'bulk' = 'annotate'
         ORDER BY created_at DESC LIMIT 1`,
        [id],
      )
    )[0].id;

  const historyOf = async (account: E2eAccount, id: string) =>
    (await as(account, request(server()).get(`/transactions/${id}/history`)).expect(200)).body
      .entries as Array<{
      id: string;
      canUndo: boolean;
      changes: Array<{ field: string; before: string | null; after: string | null }>;
    }>;

  const rollback = async (eventId: string) => {
    // Rolling back from the activity trail is for the instance admin.
    await dataSource.query(`UPDATE users SET role = 'admin' WHERE id = $1`, [owner.userId]);
    return as(owner, request(server()).post(`/audit-events/${eventId}/rollback`));
  };

  it('undoes one row from the activity trail: the added tags go, the old comment comes back', async () => {
    const { id, earlier } = await freshRow('trail');
    const added = await createTag(owner, 'Undo me');
    await annotate(owner, { ids: [id], addTagIds: [added], note: 'Temporary' }).expect(200);
    expect(await tagsOf(id)).toEqual([earlier, added].sort());

    const undone = await rollback(await latestBulkEvent(id));
    expect(undone.status).toBeLessThan(300);
    expect(undone.body.success).toBe(true);
    expect(await tagsOf(id)).toEqual([earlier]);
    expect(await commentOf(id)).toBe('Typed by hand');
  });

  it('lets a member undo the whole bulk entry from the row’s History', async () => {
    const { id, earlier } = await freshRow('history');
    const added = await createTag(owner, 'History tag');
    await annotate(owner, { ids: [id], addTagIds: [added], note: 'Holiday' }).expect(200);
    const eventId = await latestBulkEvent(id);

    const entry = (await historyOf(partner, id)).find(item => item.id === eventId);
    expect(entry?.canUndo).toBe(true);
    expect(entry?.changes).toEqual(
      expect.arrayContaining([
        { field: 'tags', before: 'Earlier history', after: 'Earlier history, History tag' },
        {
          field: 'comment',
          before: 'Typed by hand',
          after: `Typed by hand${NOTE_SEPARATOR}Holiday`,
        },
      ]),
    );

    const undo = await as(
      partner,
      request(server()).post(`/transactions/${id}/history/${eventId}/undo`),
    );
    expect(undo.status).toBeLessThan(300);
    expect(await tagsOf(id)).toEqual([earlier]);
    expect(await commentOf(id)).toBe('Typed by hand');
  });

  it('lets a member undo a tags-only bulk entry from the row’s History', async () => {
    const { id, earlier } = await freshRow('tags only');
    const added = await createTag(owner, 'Tags only');
    await annotate(owner, { ids: [id], addTagIds: [added] }).expect(200);
    const eventId = await latestBulkEvent(id);
    expect((await historyOf(partner, id)).find(item => item.id === eventId)?.canUndo).toBe(true);
    await as(partner, request(server()).post(`/transactions/${id}/history/${eventId}/undo`)).expect(
      res => expect(res.status).toBeLessThan(300),
    );
    expect(await tagsOf(id)).toEqual([earlier]);
  });

  it('will not undo tags changed by hand since, on either way back', async () => {
    const { id, earlier } = await freshRow('hand');
    const added = await createTag(owner, 'Hand tag');
    await annotate(owner, { ids: [id], addTagIds: [added] }).expect(200);
    const eventId = await latestBulkEvent(id);
    // Taken off and put back by hand: the same set, but the person chose it.
    await as(owner, request(server()).put(`/transactions/${id}/tags`))
      .send({ tagIds: [earlier] })
      .expect(200);
    await as(owner, request(server()).put(`/transactions/${id}/tags`))
      .send({ tagIds: [earlier, added] })
      .expect(200);

    expect((await historyOf(owner, id)).find(item => item.id === eventId)?.canUndo).toBe(false);
    await as(owner, request(server()).post(`/transactions/${id}/history/${eventId}/undo`)).expect(
      409,
    );
    expect((await rollback(eventId)).status).toBe(409);
    expect(await tagsOf(id)).toEqual([earlier, added].sort());
  });

  it('will not undo a comment typed over since, and keeps the new text', async () => {
    const { id } = await freshRow('typed over');
    await annotate(owner, { ids: [id], note: 'Holiday' }).expect(200);
    const eventId = await latestBulkEvent(id);
    await as(owner, request(server()).put(`/transactions/${id}`))
      .send({ comments: 'Rewritten afterwards' })
      .expect(200);

    expect((await rollback(eventId)).status).toBe(409);
    expect(await commentOf(id)).toBe('Rewritten afterwards');
    expect((await historyOf(owner, id)).find(item => item.id === eventId)?.canUndo).toBe(false);
  });

  it('leaves a row whose comment would pass 1000 characters as it was, and counts it', async () => {
    const long = await bookExpense(owner, 'Example Shop - long comment');
    const short = await bookExpense(owner, 'Example Shop - short comment');
    const tag = await createTag(owner, 'Long comment tag');
    const nearlyFull = 'x'.repeat(995);
    await as(owner, request(server()).put(`/transactions/${long}`))
      .send({ comments: nearlyFull })
      .expect(200);

    const res = await annotate(owner, {
      ids: [long, short],
      addTagIds: [tag],
      note: 'Holiday',
    }).expect(200);
    expect(res.body).toEqual({ updated: 2, skippedPrivate: 0, skippedTooLong: 1 });
    expect(await commentOf(long)).toBe(nearlyFull);
    expect(await commentOf(short)).toBe('Holiday');
    expect(await tagsOf(long)).toEqual([tag]);
  });
});
