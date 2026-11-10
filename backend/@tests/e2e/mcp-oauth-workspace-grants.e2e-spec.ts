vi.mock('franc', () => ({
  franc: () => 'und',
}));

import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { type INestApplication, ValidationPipe } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { DataSource, IsNull } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { AuditEvent } from '../../src/entities/audit-event.entity';
import { McpOAuthGrant } from '../../src/entities/mcp-oauth-grant.entity';
import { McpOAuthToken } from '../../src/entities/mcp-oauth-token.entity';
import { User } from '../../src/entities/user.entity';
import { WorkspaceMember, WorkspaceRole } from '../../src/entities/workspace-member.entity';
import { PasswordResetService } from '../../src/modules/auth/password-reset.service';
import {
  deleteUserByEmail,
  type E2eAccount,
  e2eTestingModule,
  registerAccount,
} from './helpers/e2e-app';

const ORIGIN = 'https://books.example.com';
const REDIRECT = 'http://127.0.0.1:33418/callback';
const READ = ['transaction.view'];

/**
 * The follow-ups to MCP OAuth that touch grants: the workspace-wide list of
 * connected apps for whoever manages MCP access, revoking any member's app
 * from it, a password reset ending every app of the account, and a native
 * client coming back on another loopback port.
 */
describe('MCP OAuth: workspace grants and password reset (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  const saved = { frontend: process.env.FRONTEND_URL, app: process.env.APP_URL };
  const stamp = Date.now();
  const emails = {
    owner: `wsg-owner-${stamp}@example.com`,
    member: `wsg-member-${stamp}@example.com`,
    coAdmin: `wsg-coadmin-${stamp}@example.com`,
    viewer: `wsg-viewer-${stamp}@example.com`,
    keyKeeper: `wsg-keys-${stamp}@example.com`,
    other: `wsg-other-${stamp}@example.com`,
    resetter: `wsg-resetter-${stamp}@example.com`,
  };
  const accounts = {} as Record<keyof typeof emails, E2eAccount>;
  let clientId: string;

  const server = () => app.getHttpServer();
  const as = (account: E2eAccount, req: request.Test, workspaceId = account.workspaceId) =>
    req.set('Authorization', `Bearer ${account.token}`).set('x-workspace-id', workspaceId);
  const workspaceList = (account: E2eAccount, workspaceId?: string) =>
    as(account, request(server()).get('/mcp-oauth/workspace/grants'), workspaceId);
  const adminRevoke = (account: E2eAccount, id: string, workspaceId?: string) =>
    as(account, request(server()).delete(`/mcp-oauth/workspace/grants/${id}`), workspaceId);
  const grantRow = (id: string) => dataSource.getRepository(McpOAuthGrant).findOneByOrFail({ id });

  /** Consent as `account`: the code, not yet exchanged, and its verifier. */
  const approve = async (
    account: E2eAccount,
    workspaceId = account.workspaceId,
    redirectUri = REDIRECT,
  ) => {
    const verifier = randomBytes(32).toString('base64url');
    const decided = await as(account, request(server()).post('/oauth/consent'))
      .send({
        clientId,
        redirectUri,
        responseType: 'code',
        codeChallenge: createHash('sha256').update(verifier).digest('base64url'),
        codeChallengeMethod: 'S256',
        state: 'state-1',
        approve: true,
        workspaceId,
        scopes: READ,
      })
      .expect(200);
    const back = new URL(decided.body.redirectTo);
    expect(`${back.origin}${back.pathname}`).toBe(redirectUri.split('?')[0]);
    return { code: back.searchParams.get('code') as string, verifier, redirectUri };
  };
  const exchange = (approved: Awaited<ReturnType<typeof approve>>) =>
    request(server()).post('/oauth/token').type('form').send({
      grant_type: 'authorization_code',
      code: approved.code,
      code_verifier: approved.verifier,
      redirect_uri: approved.redirectUri,
      client_id: clientId,
    });
  /** Consent and code exchange as `account`: the grant id and its tokens. */
  const connect = async (
    account: E2eAccount,
    workspaceId = account.workspaceId,
    redirectUri = REDIRECT,
  ) => {
    const tokens = await exchange(await approve(account, workspaceId, redirectUri)).expect(200);
    const token = await dataSource.getRepository(McpOAuthToken).findOneByOrFail({
      tokenHash: createHash('sha256').update(tokens.body.access_token).digest('hex'),
    });
    return {
      id: token.grantId,
      access: tokens.body.access_token as string,
      refresh: tokens.body.refresh_token as string,
    };
  };
  /** Forgot-password, then a successful reset, with a reset link we know. */
  const resetPassword = async (account: E2eAccount) => {
    await request(server()).post('/auth/forgot-password').send({ email: account.email }).expect(200);
    const token = randomUUID();
    await dataSource.query(
      'UPDATE password_reset_tokens SET token_hash = $1 WHERE user_id = $2 AND used_at IS NULL',
      [app.get(PasswordResetService)['hashToken'](token), account.userId],
    );
    await request(server())
      .post('/auth/reset-password')
      .send({ token, newPassword: 'N3w-Passphrase!' })
      .expect(200);
  };
  const liveGrantsOf = (userId: string) =>
    dataSource.getRepository(McpOAuthGrant).find({ where: { userId, revokedAt: IsNull() } });
  const callsMcp = async (accessToken: string) =>
    (
      await request(server())
        .post('/mcp')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('Accept', 'application/json, text/event-stream')
        .send({ jsonrpc: '2.0', id: 1, method: 'tools/list' })
    ).status;
  const join = (account: E2eAccount, workspaceId: string, role: WorkspaceRole) =>
    dataSource.getRepository(WorkspaceMember).save({ workspaceId, userId: account.userId, role });
  const deleteEvents = (grantId: string) =>
    dataSource
      .getRepository(AuditEvent)
      .find({ where: { entityId: grantId, action: 'delete' as never } })
      .then(events => events.filter(event => event.meta?.kind === 'mcp_oauth'));

  beforeAll(async () => {
    process.env.FRONTEND_URL = ORIGIN;
    delete process.env.APP_URL;
    const moduleFixture: TestingModule = await e2eTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    dataSource = moduleFixture.get(DataSource);

    const names = {
      owner: 'Member One',
      member: 'Member Two',
      coAdmin: 'Member Three',
      viewer: 'Member Four',
      keyKeeper: 'Member Five',
      other: 'Member Six',
      resetter: 'Member Seven',
    };
    for (const key of Object.keys(emails) as Array<keyof typeof emails>) {
      accounts[key] = await registerAccount(app, emails[key], names[key]);
    }
    const { owner, member, coAdmin, viewer, keyKeeper, other, resetter } = accounts;
    await join(member, owner.workspaceId, WorkspaceRole.MEMBER);
    await join(coAdmin, owner.workspaceId, WorkspaceRole.ADMIN);
    await join(viewer, owner.workspaceId, WorkspaceRole.VIEWER);
    await join(keyKeeper, owner.workspaceId, WorkspaceRole.MEMBER);
    await join(other, owner.workspaceId, WorkspaceRole.MEMBER);
    // A plain member whose account may manage API keys.
    await dataSource
      .getRepository(User)
      .update({ id: keyKeeper.userId }, { permissions: ['api_key.manage'] });
    for (const account of [owner, other, resetter]) {
      await as(account, request(server()).patch(`/workspaces/${account.workspaceId}`))
        .send({ plugins: { mcp: true } })
        .expect(200);
    }
    const registered = await request(server())
      .post('/oauth/register')
      .send({ client_name: 'ACME Assistant', redirect_uris: [REDIRECT] })
      .expect(201);
    clientId = registered.body.client_id;
  });

  afterAll(async () => {
    process.env.FRONTEND_URL = saved.frontend;
    if (saved.app === undefined) delete process.env.APP_URL;
    else process.env.APP_URL = saved.app;
    if (dataSource) {
      for (const email of Object.values(emails)) await deleteUserByEmail(dataSource, email);
    }
    await app.close();
  });

  describe('the workspace list', () => {
    it("shows every member's apps in this workspace, and nothing of another", async () => {
      const { owner, member, other } = accounts;
      const mine = await connect(owner);
      const theirs = await connect(member, owner.workspaceId);
      const elsewhere = await connect(other);

      const res = await workspaceList(owner).expect(200);
      const ids = res.body.map((row: { id: string }) => row.id);
      expect(ids).toEqual(expect.arrayContaining([mine.id, theirs.id]));
      expect(ids).not.toContain(elsewhere.id);
      expect(res.body.find((row: { id: string }) => row.id === theirs.id)).toMatchObject({
        memberName: 'Member Two',
        clientName: 'ACME Assistant',
        redirectHosts: ['127.0.0.1:33418'],
        scopes: READ,
        lastUsedAt: null,
      });
      expect(JSON.stringify(res.body)).not.toMatch(/@example\.com|mcp_(at|rt)_/);

      // A plain member still sees only their own.
      const own = await as(
        member,
        request(server()).get('/mcp-oauth/grants'),
        owner.workspaceId,
      ).expect(200);
      expect(own.body.map((row: { id: string }) => row.id)).toEqual([theirs.id]);
    });

    it('is open to owners, admins and whoever manages API keys, not to members or viewers', async () => {
      const { owner, member, coAdmin, viewer, keyKeeper } = accounts;
      await workspaceList(coAdmin, owner.workspaceId).expect(200);
      await workspaceList(keyKeeper, owner.workspaceId).expect(200);
      for (const account of [member, viewer]) {
        const res = await workspaceList(account, owner.workspaceId).expect(403);
        expect(res.body.error.code).toBe('AUTHZ_PERMISSIONS_REQUIRED');
      }
      // Managing one's own workspace gives nothing in another one.
      await workspaceList(owner, accounts.other.workspaceId).expect(403);
    });

    it('takes a person in a session, not an API key, even an unscoped one of a manager', async () => {
      const { owner, keyKeeper } = accounts;
      const created = await as(keyKeeper, request(server()).post('/api-keys'), owner.workspaceId)
        .send({ name: 'ACME script', scopes: ['transaction.view'] })
        .expect(201);
      // A legacy key: no scopes, its owner's full reach.
      await dataSource.query('UPDATE api_keys SET scopes = NULL WHERE id = $1', [created.body.id]);
      const withKey = (req: request.Test) =>
        req.set('X-Api-Key', created.body.key).set('x-workspace-id', owner.workspaceId);
      const listed = await withKey(request(server()).get('/mcp-oauth/workspace/grants')).expect(403);
      expect(listed.body.error.code).toBe('AUTH_API_KEY_ROUTE_FORBIDDEN');
      const mine = await connect(owner);
      await withKey(request(server()).delete(`/mcp-oauth/workspace/grants/${mine.id}`)).expect(403);
      expect((await grantRow(mine.id)).revokedAt).toBeNull();
    });
  });

  describe('revoking from it', () => {
    it("ends another member's app, logged with the reason admin", async () => {
      const { owner, member } = accounts;
      const theirs = await connect(member, owner.workspaceId);
      expect(await callsMcp(theirs.access)).toBe(200);

      await adminRevoke(owner, theirs.id).expect(204);

      const row = await grantRow(theirs.id);
      expect(row.revokedAt).not.toBeNull();
      expect(row.revokedReason).toBe('admin');
      expect(await dataSource.getRepository(McpOAuthToken).countBy({ grantId: theirs.id })).toBe(0);
      expect(await callsMcp(theirs.access)).toBe(401);
      const [event] = await deleteEvents(theirs.id);
      expect(event).toMatchObject({ workspaceId: owner.workspaceId, actorId: owner.userId });
      expect(event.meta).toMatchObject({ reason: 'admin', memberUserId: member.userId });
      // Gone from both lists.
      const list = await workspaceList(owner).expect(200);
      expect(list.body.map((r: { id: string }) => r.id)).not.toContain(theirs.id);
      await adminRevoke(owner, theirs.id).expect(404);
    });

    it("logs a manager's own app as revoked by the user", async () => {
      const mine = await connect(accounts.owner);
      await adminRevoke(accounts.owner, mine.id).expect(204);
      expect((await grantRow(mine.id)).revokedReason).toBe('user');
    });

    it("refuses a member revoking another member's app, either way", async () => {
      const { owner, member } = accounts;
      const ownersApp = await connect(owner);
      const res = await adminRevoke(member, ownersApp.id, owner.workspaceId).expect(403);
      expect(res.body.error.code).toBe('AUTHZ_PERMISSIONS_REQUIRED');
      await as(member, request(server()).delete(`/mcp-oauth/grants/${ownersApp.id}`), owner.workspaceId)
        .expect(404);
      expect((await grantRow(ownersApp.id)).revokedAt).toBeNull();
    });

    it("does not find another workspace's grant", async () => {
      const { owner, other } = accounts;
      const elsewhere = await connect(other);
      const res = await adminRevoke(owner, elsewhere.id).expect(404);
      expect(res.body.error.code).toBe('MCP_OAUTH_GRANT_NOT_FOUND');
      await adminRevoke(owner, randomUUID()).expect(404);
      expect((await grantRow(elsewhere.id)).revokedAt).toBeNull();
      expect(await callsMcp(elsewhere.access)).toBe(200);
    });
  });

  describe('a password reset', () => {
    it('revokes every app of the account in every workspace, each logged as password_reset', async () => {
      const { owner, other } = accounts;
      const home = await connect(other);
      const shared = await connect(other, owner.workspaceId);
      const bystander = await connect(owner);

      await resetPassword(other);

      for (const [grant, workspaceId] of [
        [home, other.workspaceId],
        [shared, owner.workspaceId],
      ] as const) {
        const row = await grantRow(grant.id);
        expect(row.revokedReason).toBe('password_reset');
        expect(await callsMcp(grant.access)).toBe(401);
        const [event] = await deleteEvents(grant.id);
        expect(event).toMatchObject({ workspaceId, actorId: other.userId });
        expect(event.meta?.reason).toBe('password_reset');
      }
      const refreshed = await request(server())
        .post('/oauth/token')
        .type('form')
        .send({ grant_type: 'refresh_token', refresh_token: shared.refresh, client_id: clientId });
      expect(refreshed.body.error).toBe('invalid_grant');
      // Someone else's app in the same workspace stays.
      expect((await grantRow(bystander.id)).revokedAt).toBeNull();
      expect(await callsMcp(bystander.access)).toBe(200);
    });

    it('voids codes approved before it, and a code minted by a session it ended', async () => {
      const { resetter } = accounts;
      const held = await approve(resetter);
      const late = await approve(resetter);
      await resetPassword(resetter);
      const hashOf = (code: string) => createHash('sha256').update(code).digest('hex');

      // A code held back for after the reset: burnt by it, so no grant comes of it.
      const [burnt] = await dataSource.query(
        'SELECT used_at FROM mcp_oauth_codes WHERE code_hash = $1',
        [hashOf(held.code)],
      );
      expect(burnt.used_at).not.toBeNull();
      const refused = await exchange(held).expect(400);
      expect(refused.body).toMatchObject({
        error: 'invalid_grant',
        error_description: 'The authorization code was already used',
      });
      // A code minted by a consent request that passed its session check just
      // before the reset and was stored after the burn: same rows, unused again.
      await dataSource.query('UPDATE mcp_oauth_codes SET used_at = NULL WHERE code_hash = $1', [
        hashOf(late.code),
      ]);
      const ended = await exchange(late).expect(400);
      expect(ended.body).toMatchObject({
        error: 'invalid_grant',
        error_description: 'The session that approved the code has ended',
      });
      expect(await liveGrantsOf(resetter.userId)).toEqual([]);
    });

    it('also revokes the grant of a code exchange running at that moment', async () => {
      const { resetter } = accounts;
      const [{ id: memberId }] = await dataSource.query(
        'SELECT id FROM workspace_members WHERE workspace_id = $1 AND user_id = $2',
        [resetter.workspaceId, resetter.userId],
      );
      const { tokenVersion } = await dataSource
        .getRepository(User)
        .findOneOrFail({ where: { id: resetter.userId }, select: { id: true, tokenVersion: true } });
      const [{ id: codeId }] = await dataSource.query(
        `INSERT INTO mcp_oauth_codes
           (code_hash, client_id, workspace_id, workspace_member_id, user_id, granted_role, scopes,
            redirect_uri, code_challenge, resource, expires_at, token_version)
         VALUES ($1, $2, $3, $4, $5, 'owner', '["transaction.view"]', $6, $7,
           'https://books.example.com/api/v1/mcp', now() + interval '1 minute', $8)
         RETURNING id`,
        [
          createHash('sha256').update(randomUUID()).digest('hex'),
          clientId,
          resetter.workspaceId,
          memberId,
          resetter.userId,
          REDIRECT,
          'a'.repeat(43),
          tokenVersion,
        ],
      );
      // What the token endpoint does inside its transaction, held open.
      const exchanging = dataSource.createQueryRunner();
      await exchanging.connect();
      await exchanging.startTransaction();
      let grantId = '';
      try {
        await exchanging.query('SELECT id FROM mcp_oauth_codes WHERE id = $1 FOR UPDATE', [codeId]);
        await exchanging.query('UPDATE mcp_oauth_codes SET used_at = now() WHERE id = $1', [codeId]);
        [{ id: grantId }] = await exchanging.query(
          `INSERT INTO mcp_oauth_grants
             (client_id, workspace_id, workspace_member_id, user_id, granted_role, scopes, resource)
           VALUES ($1, $2, $3, $4, 'owner', '["transaction.view"]', 'https://books.example.com/api/v1/mcp')
           RETURNING id`,
          [clientId, resetter.workspaceId, memberId, resetter.userId],
        );
        const resetting = resetPassword(resetter);
        // Until the reset waits on the code the exchange holds.
        for (let tries = 0; tries < 60; tries++) {
          const [{ waiting }] = await dataSource.query(
            `SELECT count(*)::int AS waiting FROM pg_stat_activity
              WHERE wait_event_type = 'Lock' AND query ILIKE '%mcp_oauth_codes%'`,
          );
          if (waiting > 0) break;
          await new Promise(resolve => setTimeout(resolve, 50));
        }
        await exchanging.commitTransaction();
        await resetting;
      } finally {
        await exchanging.release();
      }
      const row = await grantRow(grantId);
      expect(row.revokedReason).toBe('password_reset');
      expect(await liveGrantsOf(resetter.userId)).toEqual([]);
    });
  });

  describe('a native client on another loopback port', () => {
    it('is let through on the port it got, with the code bound to that exact address', async () => {
      const moved = 'http://127.0.0.1:51004/callback';
      const grant = await connect(accounts.owner, accounts.owner.workspaceId, moved);
      expect(await callsMcp(grant.access)).toBe(200);
    });

    it('is refused on another loopback name or path', async () => {
      for (const redirectUri of ['http://localhost:51004/callback', 'http://127.0.0.1:51004/other']) {
        const res = await as(accounts.owner, request(server()).get('/oauth/consent'))
          .query({ clientId, redirectUri, responseType: 'code', codeChallengeMethod: 'S256' })
          .expect(400);
        expect(res.body.error.code).toBe('MCP_OAUTH_REQUEST_INVALID');
      }
    });
  });
});
