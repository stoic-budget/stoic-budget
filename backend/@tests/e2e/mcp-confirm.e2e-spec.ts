vi.mock('franc', () => ({
  franc: () => 'und',
}));

import { type INestApplication, ValidationPipe } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { User, UserRole } from '../../src/entities/user.entity';
import { WorkspaceMember, WorkspaceRole } from '../../src/entities/workspace-member.entity';
import { ApiKeysService } from '../../src/modules/api-keys/api-keys.service';
import {
  deleteUserByEmail,
  type E2eAccount,
  e2eTestingModule,
  registerAccount,
} from './helpers/e2e-app';

/**
 * Bulk MCP writes go in two steps: a preview that changes nothing and hands
 * out a token, then the same call with the token. The token is bound to the
 * call, the workspace, the key and the rows, and works once.
 */
describe('MCP preview and confirm (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  const stamp = Date.now();
  const emails = {
    owner: `mcp-confirm-owner-${stamp}@example.com`,
    member: `mcp-confirm-member-${stamp}@example.com`,
    other: `mcp-confirm-other-${stamp}@example.com`,
  };
  const privateMerchant = 'Example Jeweller - Gift Ring';
  let owner: E2eAccount;
  let other: E2eAccount;
  let ownerKey: string;
  let secondOwnerKey: string;
  let otherKey: string;
  let rowIds: string[];
  let privateRowId: string;
  let categoryId: string;

  const server = () => app.getHttpServer();
  const as = (account: E2eAccount, req: request.Test) =>
    req.set('Authorization', `Bearer ${account.token}`).set('x-workspace-id', account.workspaceId);
  const callTool = async (key: string, name: string, args: Record<string, unknown>) => {
    const res = await request(server())
      .post('/mcp')
      .set('x-api-key', key)
      .set('Accept', 'application/json, text/event-stream')
      .send({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } })
      .expect(200);
    const result = res.body.result;
    return {
      isError: result.isError === true,
      body: JSON.parse(result.content[0].text),
      structured: result.structuredContent,
    };
  };
  /** What the bulk tools could change, read straight from the database. */
  const snapshot = () =>
    dataSource.query(
      `SELECT id, category_id, is_verified, updated_at FROM transactions
       WHERE workspace_id = $1 ORDER BY id`,
      [owner.workspaceId],
    );
  const auditCount = async () =>
    Number(
      (
        await dataSource.query(`SELECT count(*)::int AS n FROM audit_events WHERE workspace_id = $1`, [
          owner.workspaceId,
        ])
      )[0].n,
    );
  const resetRows = () =>
    dataSource.query(
      `UPDATE transactions SET is_verified = false, category_id = NULL WHERE workspace_id = $1`,
      [owner.workspaceId],
    );
  const spend = async (account: E2eAccount, merchant: string) => {
    const categories = await as(account, request(server()).get('/categories?type=expense')).expect(
      200,
    );
    await as(account, request(server()).post('/statements/manual-expense'))
      .field('amount', '12.5')
      .field('currency', 'EUR')
      .field('merchant', merchant)
      .field('categoryId', categories.body[0].id)
      .field('date', new Date().toISOString().slice(0, 10))
      .expect(201);
  };
  const writeKey = async (account: E2eAccount, name: string) => {
    const scopes = await as(owner, request(server()).get('/api-keys/scopes')).expect(200);
    return (
      await app
        .get(ApiKeysService)
        .generate(account.workspaceId, account.userId, name, { scopes: scopes.body.presets.write })
    ).key;
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await e2eTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    dataSource = moduleFixture.get<DataSource>(DataSource);

    owner = await registerAccount(app, emails.owner, 'Member One');
    other = await registerAccount(app, emails.other, 'Member Three');
    await dataSource.getRepository(User).update({ email: emails.owner }, { role: UserRole.ADMIN });
    for (const merchant of [
      'ACME Store - Wireless Buds',
      'Example Bakery - Rye Loaf',
      'Sample Garage - Oil Change',
      privateMerchant,
    ]) {
      await spend(owner, merchant);
    }
    await spend(other, 'ACME Store - Desk Lamp');

    // The last row belongs to a second member of the owner's workspace, kept private.
    const member = await registerAccount(app, emails.member, 'Member Two');
    const membership = await dataSource.getRepository(WorkspaceMember).save({
      workspaceId: owner.workspaceId,
      userId: member.userId,
      role: WorkspaceRole.MEMBER,
    });
    const [privateRow] = await dataSource.query(
      `UPDATE transactions SET is_private = true, owner_member_id = $2
       WHERE workspace_id = $1 AND counterparty_name = $3 RETURNING id`,
      [owner.workspaceId, membership.id, privateMerchant],
    );
    privateRowId = privateRow[0].id;
    rowIds = (await snapshot())
      .map((row: { id: string }) => row.id)
      .filter((id: string) => id !== privateRowId);

    ownerKey = await writeKey(owner, 'MCP confirm writer');
    secondOwnerKey = await writeKey(owner, 'MCP confirm second writer');
    otherKey = await writeKey(other, 'MCP confirm other');
    for (const account of [owner, other]) {
      await as(account, request(server()).patch(`/workspaces/${account.workspaceId}`))
        .send({ plugins: { mcp: true } })
        .expect(200);
    }
    const created = await as(owner, request(server()).post('/categories'))
      .send({ name: `Confirm ${stamp}`, type: 'expense' })
      .expect(201);
    categoryId = created.body.id;
  });

  beforeEach(async () => {
    await resetRows();
  });

  afterAll(async () => {
    if (dataSource) {
      for (const email of Object.values(emails)) {
        await deleteUserByEmail(dataSource, email);
      }
    }
    await app.close();
  });

  it('previews without changing anything, then applies with the token, once', async () => {
    const before = await snapshot();
    const audits = await auditCount();

    const preview = await callTool(ownerKey, 'set_transactions_category', {
      transactionIds: rowIds,
      categoryId,
    });

    expect(preview.isError).toBe(false);
    expect(preview.structured).toEqual(preview.body);
    expect(preview.body).toMatchObject({ status: 'preview', rows: rowIds.length, skipped: [] });
    expect(preview.body.examples[0]).toMatchObject({
      before: { categoryId: null, approved: false },
      after: { categoryId, categoryName: `Confirm ${stamp}`, approved: false },
    });
    expect(await snapshot()).toEqual(before);
    expect(await auditCount()).toBe(audits);

    const applied = await callTool(ownerKey, 'set_transactions_category', {
      transactionIds: rowIds,
      categoryId,
      confirmToken: preview.body.confirmToken,
    });
    expect(applied.body).toMatchObject({ status: 'applied', rows: rowIds.length });
    const after = await snapshot();
    for (const id of rowIds) {
      expect(after.find((row: { id: string }) => row.id === id).category_id).toBe(categoryId);
    }

    // Put back as previewed: only the spent token stands between a replay and a second write.
    await resetRows();
    const again = await callTool(ownerKey, 'set_transactions_category', {
      transactionIds: rowIds,
      categoryId,
      confirmToken: preview.body.confirmToken,
    });
    expect(again.isError).toBe(true);
    expect(again.body).toMatchObject({ status: 409, code: 'MCP_CONFIRM_TOKEN_USED' });
    const replayed = await snapshot();
    expect(replayed.filter((row: { category_id: string | null }) => row.category_id)).toEqual([]);
  });

  it('applies once when the same token is confirmed several times at once', async () => {
    const args = { transactionIds: rowIds, categoryId };
    const { body } = await callTool(ownerKey, 'set_transactions_category', args);
    const audits = await auditCount();

    const results = await Promise.all(
      [1, 2, 3].map(() =>
        callTool(ownerKey, 'set_transactions_category', { ...args, confirmToken: body.confirmToken }),
      ),
    );

    expect(results.map(r => r.body.status === 'applied' ? 'applied' : r.body.code).sort()).toEqual([
      'MCP_CONFIRM_TOKEN_USED',
      'MCP_CONFIRM_TOKEN_USED',
      'applied',
    ]);
    expect(await auditCount()).toBe(audits + rowIds.length);
  });

  it('accepts transaction ids in upper case', async () => {
    const args = { transactionIds: rowIds.map(id => id.toUpperCase()), categoryId };
    const preview = await callTool(ownerKey, 'set_transactions_category', args);
    expect(preview.body).toMatchObject({ rows: rowIds.length, skipped: [] });

    await callTool(ownerKey, 'set_transactions_category', {
      ...args,
      confirmToken: preview.body.confirmToken,
    });

    const after = await snapshot();
    for (const id of rowIds) {
      expect(after.find((row: { id: string }) => row.id === id).category_id).toBe(categoryId);
    }
  });

  it('refuses the token for other arguments, another tool, key or workspace', async () => {
    const args = { transactionIds: rowIds, categoryId };
    const { body } = await callTool(ownerKey, 'set_transactions_category', args);
    const confirmToken = body.confirmToken;
    const before = await snapshot();

    const attempts = [
      [ownerKey, 'set_transactions_category', { ...args, transactionIds: rowIds.slice(1) }, 'MCP_CONFIRM_TOKEN_MISMATCH'],
      [ownerKey, 'approve_transactions', { ids: rowIds, categoryId }, 'MCP_CONFIRM_TOKEN_MISMATCH'],
      [secondOwnerKey, 'set_transactions_category', args, 'MCP_CONFIRM_TOKEN_INVALID'],
      [otherKey, 'set_transactions_category', args, 'MCP_CONFIRM_TOKEN_INVALID'],
      [ownerKey, 'set_transactions_category', { ...args, confirmToken: `${confirmToken}x` }, 'MCP_CONFIRM_TOKEN_INVALID'],
    ] as const;
    for (const [key, tool, attemptArgs, code] of attempts) {
      const refused = await callTool(key, tool, { confirmToken, ...attemptArgs });
      expect({ tool, isError: refused.isError, code: refused.body.code }).toEqual({
        tool,
        isError: true,
        code,
      });
      expect(refused.body.message).toMatch(/without confirmToken/);
    }
    expect(await snapshot()).toEqual(before);

    // Nothing above spent it.
    const applied = await callTool(ownerKey, 'set_transactions_category', { ...args, confirmToken });
    expect(applied.body.status).toBe('applied');
  });

  it('refuses the token once the rows it would change are not the previewed ones', async () => {
    const args = { ids: rowIds, categoryId };
    const { body } = await callTool(ownerKey, 'approve_transactions', args);
    expect(body.rows).toBe(rowIds.length);
    // Someone approves one of them in the app meanwhile.
    await dataSource.query(`UPDATE transactions SET is_verified = true WHERE id = $1`, [rowIds[0]]);
    const before = await snapshot();

    const refused = await callTool(ownerKey, 'approve_transactions', {
      ...args,
      confirmToken: body.confirmToken,
    });

    expect(refused.isError).toBe(true);
    expect(refused.body).toMatchObject({ status: 409, code: 'MCP_CONFIRM_ROWS_CHANGED' });
    expect(await snapshot()).toEqual(before);
  });

  it('shows another member’s private row without its merchant, and skips recategorising it', async () => {
    const approveOnly = await callTool(ownerKey, 'approve_transactions', {
      ids: [privateRowId, rowIds[0]],
    });
    const recategorise = await callTool(ownerKey, 'approve_transactions', {
      ids: [privateRowId, rowIds[0]],
      categoryId,
    });

    expect(approveOnly.body.rows).toBe(2);
    const shown = approveOnly.body.examples.find((row: { id: string }) => row.id === privateRowId);
    expect(shown.counterparty).toBe('—');
    expect(JSON.stringify([approveOnly.body, recategorise.body])).not.toContain('Jeweller');
    expect(recategorise.body).toMatchObject({
      rows: 1,
      skipped: [{ reason: 'private', ids: [privateRowId] }],
    });

    await callTool(ownerKey, 'approve_transactions', {
      ids: [privateRowId, rowIds[0]],
      categoryId,
      confirmToken: recategorise.body.confirmToken,
    });
    const [privateRow] = await dataSource.query(
      `SELECT category_id, is_verified FROM transactions WHERE id = $1`,
      [privateRowId],
    );
    expect(privateRow).toEqual({ category_id: null, is_verified: false });
  });

  it('reports ids of another workspace as not found and offers nothing to confirm', async () => {
    const [foreign] = await dataSource.query(
      `SELECT id FROM transactions WHERE workspace_id = $1 LIMIT 1`,
      [other.workspaceId],
    );

    const { body } = await callTool(ownerKey, 'approve_transactions', { ids: [foreign.id] });

    expect(body).toMatchObject({
      status: 'preview',
      rows: 0,
      skipped: [{ reason: 'not_found', ids: [foreign.id] }],
      examples: [],
    });
    expect(body.confirmToken).toBeUndefined();
  });

  it('refuses a category of another workspace at the preview', async () => {
    const otherCategories = await as(other, request(server()).get('/categories?type=expense')).expect(
      200,
    );

    const refused = await callTool(ownerKey, 'set_transactions_category', {
      transactionIds: rowIds,
      categoryId: otherCategories.body[0].id,
    });

    expect(refused.isError).toBe(true);
    expect(refused.body).toMatchObject({ status: 404, code: 'WORKSPACE_REF_NOT_FOUND' });
  });
});
