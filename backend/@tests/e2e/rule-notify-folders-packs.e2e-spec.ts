vi.mock('franc', () => ({
  franc: () => 'und',
}));

import { type INestApplication, ValidationPipe } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { RuleNotifyService } from '../../src/modules/classification/services/rule-notify.service';
import {
  deleteUserByEmail,
  type E2eAccount,
  e2eTestingModule,
  registerAccount,
} from './helpers/e2e-app';

const SHOP = 'ACME STORE';
const ofx = (account: string, rows: Array<{ fitId: string; payee: string; amount: string }>) =>
  `OFXHEADER:100
DATA:OFXSGML
<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS>
<CURDEF>USD
<BANKACCTFROM><ACCTID>${account}</BANKACCTFROM>
<BANKTRANLIST><DTSTART>20260901<DTEND>20260930
${rows
  .map(
    row =>
      `<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20260906<TRNAMT>-${row.amount}<FITID>${row.fitId}<NAME>${row.payee}</STMTTRN>`,
  )
  .join('\n')}
</BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`;

/** Rule actions that tell people and leave rows out of budgets, rule folders, and rule packs. */
describe('Rule notifications, folders and packs (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  const stamp = Date.now();
  const email = `rule-notify-${stamp}@example.com`;
  const otherEmail = `rule-notify-other-${stamp}@example.com`;
  let owner: E2eAccount;
  let other: E2eAccount;

  const as = (account: E2eAccount, req: request.Test) =>
    req.set('Authorization', `Bearer ${account.token}`).set('x-workspace-id', account.workspaceId);
  const server = () => app.getHttpServer();
  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  beforeAll(async () => {
    const moduleFixture: TestingModule = await e2eTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    dataSource = moduleFixture.get<DataSource>(DataSource);
    owner = await registerAccount(app, email, 'Member One');
    other = await registerAccount(app, otherEmail, 'Member Two');
  });

  afterAll(async () => {
    if (dataSource) {
      await deleteUserByEmail(dataSource, email);
      await deleteUserByEmail(dataSource, otherEmail);
    }
    await app.close();
  });

  let uploads = 0;
  /**
   * Uploads a statement to the owner's workspace and waits for the parse. The
   * same file twice is let through, as a person re-importing it would be.
   */
  async function importFile(file: string) {
    const uploaded = await as(owner, request(server()).post('/statements'))
      .field('allowDuplicates', 'true')
      .attach('file', Buffer.from(file, 'utf-8'), {
        filename: `rules-${++uploads}.ofx`,
        contentType: 'application/octet-stream',
      })
      .expect(201);
    let statement = uploaded.body;
    const settled = ['completed', 'parsed', 'validated', 'error', 'needs_review'];
    for (let attempt = 0; attempt < 40 && !settled.includes(statement.status); attempt += 1) {
      await sleep(500);
      statement = (
        await as(owner, request(server()).get(`/statements/${uploaded.body.id}`)).expect(200)
      ).body;
    }
    expect(statement.status).not.toBe('error');
    return uploaded.body.id as string;
  }

  const ruleNotifications = (): Promise<Array<{ title: string; message: string; entity_id: string }>> =>
    dataSource.query(
      `SELECT title, message, entity_id FROM notifications
        WHERE workspace_id = $1 AND type = 'rule.matched' ORDER BY created_at`,
      [owner.workspaceId],
    );
  async function waitForNotifications(count: number) {
    for (let attempt = 0; attempt < 40; attempt += 1) {
      const rows = await ruleNotifications();
      if (rows.length >= count) return rows;
      await sleep(250);
    }
    return ruleNotifications();
  }

  it('tells about a new matching row once, not on a re-import, not on apply-to-existing', async () => {
    const wallet = await as(owner, request(server()).post('/wallets'))
      .send({ name: 'Main card', currency: 'USD' })
      .expect(201);
    const rule = await as(owner, request(server()).post('/categorization-rules'))
      .send({
        name: 'Tell me about ACME',
        conditions: [{ field: 'counterparty_name', operator: 'contains', value: 'acme store' }],
        result: { notify: { memberId: null }, comment: 'Seen by the rule' },
      })
      .expect(201);

    const file = ofx('111222333', [
      { fitId: 'N1', payee: SHOP, amount: '25.00' },
      { fitId: 'N2', payee: 'CORNER BAKERY', amount: '8.00' },
    ]);
    await as(owner, request(server()).post('/statements'))
      .field('walletId', wallet.body.id)
      .attach('file', Buffer.from(file, 'utf-8'), {
        filename: `rules-${++uploads}.ofx`,
        contentType: 'application/octet-stream',
      })
      .expect(201);
    const [told] = await waitForNotifications(1);
    expect(told.title).toContain('Tell me about ACME');
    expect(told.message).toContain(SHOP);
    expect(told.message).toContain('Main card');

    // The same file again, then a new matching row: only the new row is news.
    await importFile(file);
    await importFile(ofx('111222333', [{ fitId: 'N3', payee: SHOP, amount: '31.00' }]));
    const after = await waitForNotifications(2);
    await sleep(750);
    expect(await ruleNotifications()).toHaveLength(2);
    expect(after[1].entity_id).not.toBe(told.entity_id);

    // Applying the rule to the rows already there writes its comment and tells nobody.
    await dataSource.query(
      'UPDATE transactions SET comments = NULL WHERE workspace_id = $1 AND counterparty_name = $2',
      [owner.workspaceId, SHOP],
    );
    const applied = await as(
      owner,
      request(server()).post(`/categorization-rules/${rule.body.id}/apply`),
    ).expect(200);
    expect(applied.body.commented).toBeGreaterThan(0);
    await sleep(500);
    expect(await ruleNotifications()).toHaveLength(2);

    // The claim in rule_notify_marks, not the duplicate filter, keeps a row from
    // telling twice: the told row asked about again, then a later copy of it
    // (the same purchase under a new id, the old one now the duplicate).
    const notifier = app.get(RuleNotifyService);
    expect(await notifier.notifyNewRows(owner.workspaceId, [told.entity_id])).toBe(0);
    const [{ fingerprint }]: Array<{ fingerprint: string | null }> = await dataSource.query(
      'SELECT fingerprint FROM transactions WHERE id = $1',
      [told.entity_id],
    );
    expect(fingerprint).toBeTruthy();
    await dataSource.query('UPDATE transactions SET is_duplicate = true WHERE id = $1', [
      told.entity_id,
    ]);
    const [{ id: copy }]: Array<{ id: string }> = await dataSource.query(
      `INSERT INTO transactions
       SELECT (jsonb_populate_record(NULL::transactions,
                 to_jsonb(t) || jsonb_build_object('id', gen_random_uuid(), 'is_duplicate', false))).*
         FROM transactions t WHERE t.id = $1
       RETURNING id`,
      [told.entity_id],
    );
    expect(await notifier.notifyNewRows(owner.workspaceId, [copy])).toBe(0);
    expect(await ruleNotifications()).toHaveLength(2);
    await dataSource.query('DELETE FROM transactions WHERE id = $1', [copy]);
    await dataSource.query('UPDATE transactions SET is_duplicate = false WHERE id = $1', [
      told.entity_id,
    ]);
    await as(owner, request(server()).delete(`/categorization-rules/${rule.body.id}`)).expect(204);
  });

  it("refuses to tell a member of another workspace", async () => {
    const [{ id: theirMember }]: Array<{ id: string }> = await dataSource.query(
      'SELECT id FROM workspace_members WHERE workspace_id = $1',
      [other.workspaceId],
    );
    await as(owner, request(server()).post('/categorization-rules'))
      .send({
        name: 'Tell them',
        conditions: [{ field: 'counterparty_name', operator: 'contains', value: 'acme' }],
        result: { notify: { memberId: theirMember } },
      })
      .expect(400);
  });

  it('leaves a new matching row out of budgets on import, and old ones on apply', async () => {
    const rule = await as(owner, request(server()).post('/categorization-rules'))
      .send({
        name: 'Gifts are not spending',
        conditions: [{ field: 'counterparty_name', operator: 'contains', value: 'gift shop' }],
        result: { excludeFromBudgets: true },
      })
      .expect(201);
    await importFile(ofx('444555666', [{ fitId: 'G1', payee: 'GIFT SHOP', amount: '40.00' }]));
    const flagOf = async () =>
      (
        (await dataSource.query(
          'SELECT excluded_from_budgets FROM transactions WHERE workspace_id = $1 AND counterparty_name = $2',
          [owner.workspaceId, 'GIFT SHOP'],
        )) as Array<{ excluded_from_budgets: boolean }>
      ).map(row => row.excluded_from_budgets);
    expect(await flagOf()).toEqual([true]);

    await dataSource.query(
      'UPDATE transactions SET excluded_from_budgets = false WHERE workspace_id = $1 AND counterparty_name = $2',
      [owner.workspaceId, 'GIFT SHOP'],
    );
    const applied = await as(
      owner,
      request(server()).post(`/categorization-rules/${rule.body.id}/apply`),
    ).expect(200);
    expect(applied.body.excluded).toBe(1);
    expect(await flagOf()).toEqual([true]);
    const [event]: Array<{ diff: { before: unknown; after: unknown } }> = await dataSource.query(
      `SELECT diff FROM audit_events WHERE workspace_id = $1 AND action = 'apply_rule'
         AND meta->>'ruleId' = $2 AND diff IS NOT NULL`,
      [owner.workspaceId, rule.body.id],
    );
    expect(event.diff).toEqual({
      before: { excludedFromBudgets: false },
      after: { excludedFromBudgets: true },
    });
    await as(owner, request(server()).delete(`/categorization-rules/${rule.body.id}`)).expect(204);
  });

  it('keeps folders to their workspace and moves rules in and out of them', async () => {
    const folder = await as(owner, request(server()).post('/categorization-rule-groups'))
      .send({ name: 'Groceries' })
      .expect(201);
    await as(owner, request(server()).post('/categorization-rule-groups'))
      .send({ name: '   ' })
      .expect(400);
    const rule = await as(owner, request(server()).post('/categorization-rules'))
      .send({
        name: 'Bakery',
        conditions: [{ field: 'counterparty_name', operator: 'contains', value: 'bakery' }],
        result: { comment: 'Bread' },
        groupId: folder.body.id,
      })
      .expect(201);
    expect(rule.body.groupId).toBe(folder.body.id);

    // The other workspace neither sees, renames, deletes nor files into it.
    const theirs = await as(other, request(server()).get('/categorization-rule-groups')).expect(200);
    expect(theirs.body.data).toEqual([]);
    await as(other, request(server()).put(`/categorization-rule-groups/${folder.body.id}`))
      .send({ name: 'Taken' })
      .expect(404);
    await as(other, request(server()).delete(`/categorization-rule-groups/${folder.body.id}`)).expect(
      404,
    );
    await as(other, request(server()).post('/categorization-rules'))
      .send({
        name: 'Into theirs',
        conditions: [{ field: 'counterparty_name', operator: 'contains', value: 'x' }],
        result: { comment: 'x' },
        groupId: folder.body.id,
      })
      .expect(404);
    const [{ name }]: Array<{ name: string }> = await dataSource.query(
      'SELECT name FROM rule_groups WHERE id = $1',
      [folder.body.id],
    );
    expect(name).toBe('Groceries');

    const out = await as(owner, request(server()).put(`/categorization-rules/${rule.body.id}`))
      .send({ groupId: null })
      .expect(200);
    expect(out.body.groupId).toBeNull();
    await as(owner, request(server()).put(`/categorization-rules/${rule.body.id}`))
      .send({ groupId: folder.body.id })
      .expect(200);
    await as(owner, request(server()).delete(`/categorization-rule-groups/${folder.body.id}`)).expect(
      204,
    );
    const kept = await as(owner, request(server()).get(`/categorization-rules/${rule.body.id}`)).expect(
      200,
    );
    expect(kept.body.groupId).toBeNull();
    await as(owner, request(server()).delete(`/categorization-rules/${rule.body.id}`)).expect(204);
  });

  it('previews a pack in another workspace without writing, then imports what it confirmed', async () => {
    const tag = await as(owner, request(server()).post('/tags')).send({ name: 'Pets' }).expect(201);
    const category = await as(owner, request(server()).post('/categories'))
      .send({ name: 'Pet food', type: 'expense' })
      .expect(201);
    const wallet = await as(owner, request(server()).post('/wallets'))
      .send({ name: 'Savings jar', currency: 'USD' })
      .expect(201);
    const folder = await as(owner, request(server()).post('/categorization-rule-groups'))
      .send({ name: 'Pets' })
      .expect(201);
    const food = await as(owner, request(server()).post('/categorization-rules'))
      .send({
        name: 'Pet shop',
        conditions: [{ field: 'counterparty_name', operator: 'contains', value: 'pet shop' }],
        result: { categoryId: category.body.id, tagIds: [tag.body.id] },
        groupId: folder.body.id,
      })
      .expect(201);
    const moved = await as(owner, request(server()).post('/categorization-rules'))
      .send({
        name: 'Round-ups',
        conditions: [{ field: 'counterparty_name', operator: 'contains', value: 'round up' }],
        result: { walletId: wallet.body.id },
      })
      .expect(201);
    const pack = (
      await as(owner, request(server()).post('/categorization-rule-packs/export'))
        .send({ ruleIds: [food.body.id, moved.body.id] })
        .expect(200)
    ).body;
    expect(JSON.stringify(pack)).not.toContain(category.body.id);
    // Another workspace cannot export them.
    await as(other, request(server()).post('/categorization-rule-packs/export'))
      .send({ ruleIds: [food.body.id] })
      .expect(404);

    const counts = async () =>
      (
        await dataSource.query(
          `SELECT (SELECT count(*) FROM categorization_rules WHERE workspace_id = $1) AS rules,
                  (SELECT count(*) FROM categories WHERE workspace_id = $1) AS categories,
                  (SELECT count(*) FROM tags WHERE workspace_id = $1) AS tags,
                  (SELECT count(*) FROM rule_groups WHERE workspace_id = $1) AS folders`,
          [other.workspaceId],
        )
      )[0];
    const before = await counts();
    const preview = await as(other, request(server()).post('/categorization-rule-packs/preview'))
      .send({ pack, createMissing: true })
      .expect(200);
    expect(await counts()).toEqual(before);
    const byName = Object.fromEntries(
      preview.body.rules.map((rule: { name: string }) => [rule.name, rule]),
    );
    expect(byName['Pet shop']).toMatchObject({ outcome: 'create', folder: 'Pets', invalid: false });
    expect(byName['Pet shop'].missing).toEqual(
      expect.arrayContaining([
        { kind: 'category', name: 'Pet food', creatable: true },
        { kind: 'tag', name: 'Pets', creatable: true },
      ]),
    );
    // An account cannot be made: that rule is left out.
    expect(byName['Round-ups']).toMatchObject({
      outcome: 'skip',
      missing: [{ kind: 'account', name: 'Savings jar', creatable: false }],
    });
    expect(preview.body.newFolders).toEqual(['Pets']);

    const withoutMaking = await as(other, request(server()).post('/categorization-rule-packs/preview'))
      .send({ pack, createMissing: false })
      .expect(200);
    expect(withoutMaking.body.rules.map((rule: { outcome: string }) => rule.outcome)).toEqual([
      'skip',
      'skip',
    ]);

    const imported = await as(other, request(server()).post('/categorization-rule-packs/import'))
      .send({ pack, createMissing: true })
      .expect(200);
    expect(imported.body).toEqual({ created: 1, skipped: 1 });
    const rules = (await as(other, request(server()).get('/categorization-rules')).expect(200)).body
      .data as Array<{ name: string; result: { categoryId: string; tagIds: string[] }; groupId: string }>;
    const made = rules.find(rule => rule.name === 'Pet shop');
    const [{ id: theirCategory }]: Array<{ id: string }> = await dataSource.query(
      'SELECT id FROM categories WHERE workspace_id = $1 AND name = $2',
      [other.workspaceId, 'Pet food'],
    );
    expect(made?.result.categoryId).toBe(theirCategory);
    expect(made?.result.categoryId).not.toBe(category.body.id);
    expect(made?.groupId).toBeTruthy();
    const after = await counts();
    expect(Number(after.rules)).toBe(Number(before.rules) + 1);
    expect(Number(after.folders)).toBe(Number(before.folders) + 1);
  });

  it('exports rules pointing at deleted records, and adds nothing on a second import', async () => {
    const tag = await as(owner, request(server()).post('/tags'))
      .send({ name: 'Short-lived' })
      .expect(201);
    const category = await as(owner, request(server()).post('/categories'))
      .send({ name: 'Gone soon', type: 'expense' })
      .expect(201);
    const stale = await as(owner, request(server()).post('/categorization-rules'))
      .send({
        name: 'Stale refs',
        conditions: [{ field: 'counterparty_name', operator: 'contains', value: 'stale' }],
        result: { categoryId: category.body.id, comment: 'Old' },
      })
      .expect(201);
    const twice = await as(owner, request(server()).post('/categorization-rules'))
      .send({
        name: 'Twice notify',
        conditions: [{ field: 'counterparty_name', operator: 'contains', value: 'twice' }],
        result: { notify: { memberId: null }, tagIds: [tag.body.id] },
      })
      .expect(201);
    await as(owner, request(server()).delete(`/tags/${tag.body.id}`)).expect(
      (res: request.Response) => expect([200, 204]).toContain(res.status),
    );
    await as(owner, request(server()).delete(`/categories/${category.body.id}`)).expect(
      (res: request.Response) => expect([200, 204]).toContain(res.status),
    );

    const pack = (
      await as(owner, request(server()).post('/categorization-rule-packs/export'))
        .send({ ruleIds: [stale.body.id, twice.body.id] })
        .expect(200)
    ).body;
    const exported = Object.fromEntries(
      pack.rules.map((rule: { name: string; result: unknown }) => [rule.name, rule.result]),
    );
    // The gone category travels blank; the gone tag did nothing, so it is dropped.
    expect(exported).toEqual({
      'Stale refs': { category: '', comment: 'Old' },
      'Twice notify': { notify: { member: null } },
    });

    const preview = async () =>
      Object.fromEntries(
        (
          await as(other, request(server()).post('/categorization-rule-packs/preview'))
            .send({ pack, createMissing: true })
            .expect(200)
        ).body.rules.map((rule: { name: string }) => [rule.name, rule]),
      );
    const first = await preview();
    expect(first['Stale refs']).toMatchObject({
      outcome: 'skip',
      exists: false,
      missing: [{ kind: 'category', name: '', creatable: false }],
    });
    expect(first['Twice notify']).toMatchObject({ outcome: 'create', exists: false });
    await as(other, request(server()).post('/categorization-rule-packs/import'))
      .send({ pack, createMissing: true })
      .expect(200, { created: 1, skipped: 1 });

    // The same pack again: the rule is there already, so nothing doubles.
    expect((await preview())['Twice notify']).toMatchObject({ outcome: 'skip', exists: true });
    await as(other, request(server()).post('/categorization-rule-packs/import'))
      .send({ pack, createMissing: true })
      .expect(200, { created: 0, skipped: 2 });
    const [{ count }]: Array<{ count: string }> = await dataSource.query(
      'SELECT count(*) FROM categorization_rules WHERE workspace_id = $1 AND name = $2',
      [other.workspaceId, 'Twice notify'],
    );
    expect(Number(count)).toBe(1);
    for (const id of [stale.body.id, twice.body.id]) {
      await as(owner, request(server()).delete(`/categorization-rules/${id}`)).expect(204);
    }
  });

  it('refuses a pack that is not one', async () => {
    await as(other, request(server()).post('/categorization-rule-packs/preview'))
      .send({ pack: { kind: 'something-else', version: 1, exportedAt: '', rules: [] }, createMissing: false })
      .expect(400);
  });
});
