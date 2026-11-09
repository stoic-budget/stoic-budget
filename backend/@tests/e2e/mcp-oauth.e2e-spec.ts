vi.mock('franc', () => ({
  franc: () => 'und',
}));

import { createHash, randomBytes } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import { auth, type OAuthClientProvider } from '@modelcontextprotocol/sdk/client/auth.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type {
  OAuthClientInformationMixed,
  OAuthTokens,
} from '@modelcontextprotocol/sdk/shared/auth.js';
import { type INestApplication, ValidationPipe } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { AuditEvent } from '../../src/entities/audit-event.entity';
import { McpOAuthGrant } from '../../src/entities/mcp-oauth-grant.entity';
import { McpOAuthToken } from '../../src/entities/mcp-oauth-token.entity';
import { User, UserRole } from '../../src/entities/user.entity';
import { WorkspaceMember, WorkspaceRole } from '../../src/entities/workspace-member.entity';
import { BackupDataService } from '../../src/modules/backups/backup-data.service';
import {
  deleteUserByEmail,
  type E2eAccount,
  e2eTestingModule,
  registerAccount,
} from './helpers/e2e-app';

const ORIGIN = 'https://books.example.com';
const RESOURCE = `${ORIGIN}/api/v1/mcp`;
const REDIRECT = 'http://127.0.0.1:33418/callback';

const succeeded = (res: request.Response) => {
  if (res.status >= 300) throw new Error(`${res.status} ${JSON.stringify(res.body)}`);
};

const pkcePair = () => {
  const verifier = randomBytes(32).toString('base64url');
  return { verifier, challenge: createHash('sha256').update(verifier).digest('base64url') };
};

/**
 * OAuth 2.1 for the MCP endpoint, end to end: registration, consent as a
 * signed-in person, code with PKCE, MCP calls with the token, rotation with
 * reuse detection, revocation, and every way access must end.
 */
describe('MCP OAuth (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  const savedFrontendUrl = process.env.FRONTEND_URL;
  const savedAppUrl = process.env.APP_URL;
  const stamp = Date.now();
  const emails = {
    owner: `oauth-owner-${stamp}@example.com`,
    member: `oauth-member-${stamp}@example.com`,
    other: `oauth-other-${stamp}@example.com`,
    admin: `oauth-admin-${stamp}@example.com`,
  };
  let owner: E2eAccount;
  let member: E2eAccount;
  let other: E2eAccount;
  let admin: E2eAccount;
  let clientId: string;
  let otherTransactionId: string;

  const server = () => app.getHttpServer();
  const as = (account: E2eAccount, req: request.Test, workspaceId = account.workspaceId) =>
    req.set('Authorization', `Bearer ${account.token}`).set('x-workspace-id', workspaceId);
  const register = (body: object) => request(server()).post('/oauth/register').send(body);
  const form = (url: string, fields: Record<string, string | undefined>) =>
    request(server())
      .post(url)
      .type('form')
      .send(
        Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined)),
      );
  const rpc = (accessToken: string, method: string, params?: Record<string, unknown>) =>
    request(server())
      .post('/mcp')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('Accept', 'application/json, text/event-stream')
      .send({ jsonrpc: '2.0', id: 1, method, ...(params ? { params } : {}) });
  const callTool = async (accessToken: string, name: string, args: object = {}) => {
    const res = await rpc(accessToken, 'tools/call', { name, arguments: args }).expect(200);
    return { isError: res.body.result.isError === true, text: res.body.result.content[0].text as string };
  };
  const authorizationQuery = (challenge: string, extra: Record<string, string> = {}) => ({
    clientId,
    redirectUri: REDIRECT,
    responseType: 'code',
    codeChallenge: challenge,
    codeChallengeMethod: 'S256',
    state: 'state-1',
    resource: RESOURCE,
    ...extra,
  });
  /** Consent as `account`: the code the browser would carry back, and the PKCE verifier. */
  const approve = async (
    account: E2eAccount,
    scopes: string[],
    workspaceId = account.workspaceId,
  ) => {
    const { verifier, challenge } = pkcePair();
    const res = await as(account, request(server()).post('/oauth/consent'))
      .send({ ...authorizationQuery(challenge), approve: true, workspaceId, scopes })
      .expect(200);
    const back = new URL(res.body.redirectTo);
    expect(back.origin + back.pathname).toBe(REDIRECT);
    expect(back.searchParams.get('state')).toBe('state-1');
    expect(back.searchParams.get('iss')).toBe(ORIGIN);
    return { code: back.searchParams.get('code') as string, verifier };
  };
  const exchange = (code: string, verifier: string, extra: Record<string, string> = {}) =>
    form('/oauth/token', {
      grant_type: 'authorization_code',
      code,
      code_verifier: verifier,
      redirect_uri: REDIRECT,
      client_id: clientId,
      resource: RESOURCE,
      ...extra,
    });
  const refresh = (refreshToken: string) =>
    form('/oauth/token', {
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId,
      resource: RESOURCE,
    });
  const connect = async (account: E2eAccount, scopes: string[], workspaceId?: string) => {
    const { code, verifier } = await approve(account, scopes, workspaceId);
    const res = await exchange(code, verifier).expect(200);
    return res.body as { access_token: string; refresh_token: string; scope: string };
  };
  const grantOf = async (accessToken: string) => {
    const token = await dataSource.getRepository(McpOAuthToken).findOneOrFail({
      where: { tokenHash: createHash('sha256').update(accessToken).digest('hex') },
    });
    return dataSource.getRepository(McpOAuthGrant).findOneBy({ id: token.grantId });
  };
  const setPlugin = (account: E2eAccount, workspaceId: string, mcp: boolean) =>
    as(account, request(server()).patch(`/workspaces/${workspaceId}`), workspaceId)
      .send({ plugins: { mcp } })
      .expect(200);
  const readScopes = ['transaction.view', 'category.view'];
  const writeScopes = [...readScopes, 'category.create'];

  beforeAll(async () => {
    process.env.FRONTEND_URL = ORIGIN;
    delete process.env.APP_URL;
    const moduleFixture: TestingModule = await e2eTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    dataSource = moduleFixture.get(DataSource);

    owner = await registerAccount(app, emails.owner, 'Member One');
    member = await registerAccount(app, emails.member, 'Member Two');
    other = await registerAccount(app, emails.other, 'Member Three');
    admin = await registerAccount(app, emails.admin, 'Member Admin');
    await dataSource.getRepository(User).update({ email: emails.admin }, { role: UserRole.ADMIN });
    await dataSource.getRepository(WorkspaceMember).save({
      workspaceId: owner.workspaceId,
      userId: member.userId,
      role: WorkspaceRole.MEMBER,
    });
    await setPlugin(owner, owner.workspaceId, true);
    await setPlugin(other, other.workspaceId, true);

    const categories = await as(other, request(server()).get('/categories?type=expense')).expect(200);
    await as(other, request(server()).post('/statements/manual-expense'))
      .field('amount', '12.5')
      .field('currency', 'EUR')
      .field('merchant', 'ACME Store - Other Coffee')
      .field('categoryId', categories.body[0].id)
      .field('date', new Date().toISOString().slice(0, 10))
      .expect(201);
    otherTransactionId = (await as(other, request(server()).get('/transactions')).expect(200)).body
      .data[0].id;

    const registered = await register({
      client_name: 'ACME Assistant',
      redirect_uris: [REDIRECT],
      token_endpoint_auth_method: 'none',
      grant_types: ['authorization_code', 'refresh_token'],
      software_id: 'ignored-unknown-metadata',
    }).expect(201);
    clientId = registered.body.client_id;
  });

  afterAll(async () => {
    process.env.FRONTEND_URL = savedFrontendUrl;
    if (savedAppUrl === undefined) delete process.env.APP_URL;
    else process.env.APP_URL = savedAppUrl;
    if (dataSource) {
      for (const email of Object.values(emails)) {
        await deleteUserByEmail(dataSource, email);
      }
    }
    await app.close();
  });

  describe('discovery', () => {
    it('publishes protected resource and authorization server metadata', async () => {
      const resource = await request(server()).get('/oauth/protected-resource').expect(200);
      expect(resource.body).toMatchObject({
        resource: RESOURCE,
        authorization_servers: [ORIGIN],
        bearer_methods_supported: ['header'],
      });
      expect(resource.body.scopes_supported).toBeUndefined();

      const metadata = await request(server()).get('/oauth/authorization-server').expect(200);
      expect(metadata.body).toMatchObject({
        issuer: ORIGIN,
        authorization_endpoint: `${ORIGIN}/oauth/authorize`,
        token_endpoint: `${ORIGIN}/api/v1/oauth/token`,
        registration_endpoint: `${ORIGIN}/api/v1/oauth/register`,
        revocation_endpoint: `${ORIGIN}/api/v1/oauth/revoke`,
        code_challenge_methods_supported: ['S256'],
        token_endpoint_auth_methods_supported: ['none'],
        grant_types_supported: ['authorization_code', 'refresh_token'],
      });
    });

    it('points an unauthenticated MCP request at the metadata', async () => {
      const res = await request(server())
        .post('/mcp')
        .send({ jsonrpc: '2.0', id: 1, method: 'tools/list' })
        .expect(401);
      expect(res.body.error.code).toBe('MCP_CREDENTIALS_REQUIRED');
      expect(String(res.headers['www-authenticate'])).toContain(
        `Bearer resource_metadata="${ORIGIN}/.well-known/oauth-protected-resource/api/v1/mcp"`,
      );
    });

    it('marks a bad token invalid_token, a session JWT included', async () => {
      for (const token of ['mcp_at_nonsense', owner.token]) {
        const res = await rpc(token, 'tools/list').expect(401);
        expect(res.body.error.code).toBe('MCP_ACCESS_TOKEN_INVALID');
        expect(String(res.headers['www-authenticate'])).toContain('error="invalid_token"');
      }
    });

    it('does not accept an access token anywhere but the MCP endpoint', async () => {
      const { access_token } = await connect(owner, readScopes);
      await request(server())
        .get('/transactions')
        .set('Authorization', `Bearer ${access_token}`)
        .set('x-workspace-id', owner.workspaceId)
        .expect(401);
    });
  });

  describe('client registration', () => {
    it.each([
      ['plain http elsewhere', { redirect_uris: ['http://app.example.com/cb'] }],
      ['a fragment', { redirect_uris: ['https://app.example.com/cb#x'] }],
      ['user info', { redirect_uris: ['https://app.example.com@evil.example.com/cb'] }],
      ['a custom scheme', { redirect_uris: ['example-app://cb'] }],
      ['no redirect URI', { redirect_uris: [] }],
      ['six redirect URIs', { redirect_uris: Array(6).fill('https://app.example.com/cb') }],
    ])('refuses %s', async (_label, body) => {
      const res = await register({ client_name: 'Nope', ...body }).expect(400);
      expect(res.body.error).toBe('invalid_redirect_uri');
    });

    it('refuses confidential clients and other grant types', async () => {
      for (const extra of [
        { token_endpoint_auth_method: 'client_secret_basic' },
        { grant_types: ['client_credentials'] },
        { response_types: ['token'] },
      ]) {
        const res = await register({ redirect_uris: [REDIRECT], ...extra }).expect(400);
        expect(res.body.error).toBe('invalid_client_metadata');
      }
    });

    it('answers RFC 7591 fields and names a nameless client after its host', async () => {
      const res = await register({ redirect_uris: ['https://app.example.com/cb'] }).expect(201);
      expect(res.body).toMatchObject({
        client_name: 'app.example.com',
        redirect_uris: ['https://app.example.com/cb'],
        token_endpoint_auth_method: 'none',
      });
      expect(res.body.client_secret).toBeUndefined();
      expect(res.headers['cache-control']).toBe('no-store');
    });

    it('keeps control and direction characters out of the name people see', async () => {
      const res = await register({
        client_name: 'ACME\u202E tnatsissA\u0000\u200B',
        redirect_uris: [REDIRECT],
      }).expect(201);
      expect(res.body.client_name).toBe('ACME tnatsissA');
    });

    it('can be closed by the instance administrator, and only by them', async () => {
      await as(owner, request(server()).put('/settings/instance/mcp-oauth-registration'))
        .send({ open: false })
        .expect(403);
      await as(admin, request(server()).put('/settings/instance/mcp-oauth-registration'))
        .send({ open: false })
        .expect(200, { open: false });
      try {
        const res = await register({ redirect_uris: [REDIRECT] }).expect(403);
        expect(res.body.error).toBe('access_denied');
        const metadata = await request(server()).get('/oauth/authorization-server').expect(200);
        expect(metadata.body.registration_endpoint).toBeUndefined();
        // Clients registered before keep working.
        await connect(owner, readScopes);
      } finally {
        await as(admin, request(server()).put('/settings/instance/mcp-oauth-registration'))
          .send({ open: true })
          .expect(200, { open: true });
      }
    });
  });

  describe('consent', () => {
    it('lists the workspaces with what the role allows', async () => {
      const { challenge } = pkcePair();
      const res = await as(member, request(server()).get('/oauth/consent'))
        .query(authorizationQuery(challenge, { scope: 'transaction.view nonsense.scope' }))
        .expect(200);
      expect(res.body).toMatchObject({
        kind: 'consent',
        clientName: 'ACME Assistant',
        redirectHost: '127.0.0.1:33418',
        requestedScopes: ['transaction.view'],
      });
      const shared = res.body.workspaces.find((w: { id: string }) => w.id === owner.workspaceId);
      const own = res.body.workspaces.find((w: { id: string }) => w.id === member.workspaceId);
      expect(shared.mcpEnabled).toBe(true);
      expect(own.mcpEnabled).toBe(false);
      expect(shared.read).toContain('transaction.view');
      expect(shared.read).not.toContain('category.create');
      // A plain member of the shared workspace may not create categories; in their own they may.
      expect(shared.write).not.toContain('category.create');
      expect(own.write).toContain('category.create');
      expect(own.read).not.toContain('category.create');
      expect(own.write).not.toContain('api_key.manage');
      expect(res.body.workspaces.map((w: { id: string }) => w.id)).not.toContain(other.workspaceId);
    });

    it('answers an unknown client or an unregistered redirect on the page, not at the address', async () => {
      const { challenge } = pkcePair();
      for (const extra of [
        { redirectUri: 'http://127.0.0.1:33419/callback' },
        { redirectUri: 'http://127.0.0.1:33418/callback/evil' },
        { redirectUri: 'https://127.0.0.1:33418/callback' },
        { clientId: '00000000-0000-4000-8000-000000000000' },
        { clientId: 'not-a-uuid' },
      ]) {
        const res = await as(owner, request(server()).get('/oauth/consent'))
          .query(authorizationQuery(challenge, extra))
          .expect(400);
        expect(res.body.error.code).toBe('MCP_OAUTH_REQUEST_INVALID');
      }
    });

    it('sends plain PKCE, a missing challenge and another resource back with an error', async () => {
      const { challenge } = pkcePair();
      for (const [extra, error] of [
        [{ codeChallengeMethod: 'plain' }, 'invalid_request'],
        [{ codeChallenge: '' }, 'invalid_request'],
        [{ responseType: 'token' }, 'unsupported_response_type'],
        [{ resource: 'https://evil.example.com/api/v1/mcp' }, 'invalid_target'],
      ] as const) {
        const res = await as(owner, request(server()).get('/oauth/consent'))
          .query(authorizationQuery(challenge, extra))
          .expect(200);
        expect(res.body.kind).toBe('redirect');
        const back = new URL(res.body.redirectTo);
        expect(back.searchParams.get('error')).toBe(error);
        expect(back.searchParams.get('state')).toBe('state-1');
      }
    });

    it('answers a denial with access_denied and no code', async () => {
      const { challenge } = pkcePair();
      const res = await as(owner, request(server()).post('/oauth/consent'))
        .send({
          ...authorizationQuery(challenge),
          approve: false,
          workspaceId: owner.workspaceId,
          scopes: readScopes,
        })
        .expect(200);
      const back = new URL(res.body.redirectTo);
      expect(back.searchParams.get('error')).toBe('access_denied');
      expect(back.searchParams.get('code')).toBeNull();
    });

    it('refuses a workspace the person is not in, and one with MCP off', async () => {
      const { challenge } = pkcePair();
      const decide = (workspaceId: string) =>
        as(member, request(server()).post('/oauth/consent')).send({
          ...authorizationQuery(challenge),
          approve: true,
          workspaceId,
          scopes: readScopes,
        });
      expect((await decide(other.workspaceId).expect(403)).body.error.code).toBe(
        'WORKSPACE_NOT_A_MEMBER',
      );
      expect((await decide(member.workspaceId).expect(403)).body.error.code).toBe(
        'PLUGIN_DISABLED',
      );
    });

    it('refuses scopes beyond the role, and none at all', async () => {
      const viewer = await registerAccount(app, `oauth-viewer-${stamp}@example.com`, 'Member Four');
      try {
        await dataSource.getRepository(WorkspaceMember).save({
          workspaceId: owner.workspaceId,
          userId: viewer.userId,
          role: WorkspaceRole.VIEWER,
        });
        const { challenge } = pkcePair();
        for (const scopes of [['category.create'], []]) {
          const res = await as(viewer, request(server()).post('/oauth/consent'))
            .send({
              ...authorizationQuery(challenge),
              approve: true,
              workspaceId: owner.workspaceId,
              scopes,
            })
            .expect(400);
          expect(res.body.error.code).toBe('MCP_OAUTH_SCOPES_INVALID');
        }
        // Not grantable to anything: the contract refuses it outright.
        await as(viewer, request(server()).post('/oauth/consent'))
          .send({
            ...authorizationQuery(challenge),
            approve: true,
            workspaceId: owner.workspaceId,
            scopes: ['api_key.manage'],
          })
          .expect(400);
      } finally {
        await deleteUserByEmail(dataSource, viewer.email);
      }
    });

    it('takes no consent from an API key', async () => {
      await dataSource.getRepository(User).update({ email: emails.owner }, { role: UserRole.ADMIN });
      try {
        const key = (
          await as(owner, request(server()).post('/api-keys'))
            .send({ name: 'Consent key', scopes: ['transaction.view'] })
            .expect(201)
        ).body.key;
        const { challenge } = pkcePair();
        await request(server())
          .get('/oauth/consent')
          .set('x-api-key', key)
          .query(authorizationQuery(challenge))
          .expect(403);
      } finally {
        await dataSource.getRepository(User).update({ email: emails.owner }, { role: UserRole.USER });
      }
    });
  });

  describe('tokens', () => {
    it('runs the whole flow: code, MCP call, refresh, reuse detection', async () => {
      const { code, verifier } = await approve(member, readScopes, owner.workspaceId);
      const first = await exchange(code, verifier).expect(200);
      expect(first.headers['cache-control']).toBe('no-store');
      expect(first.body).toMatchObject({ token_type: 'Bearer', expires_in: 3600 });
      expect(first.body.scope.split(' ').sort()).toEqual([...readScopes].sort());
      expect(first.body.access_token).toMatch(/^mcp_at_/);
      expect(first.body.refresh_token).toMatch(/^mcp_rt_/);

      const tools = await rpc(first.body.access_token, 'tools/list').expect(200);
      const names = tools.body.result.tools.map((tool: { name: string }) => tool.name);
      expect(names).toEqual(expect.arrayContaining(['list_transactions', 'list_categories']));
      expect(names).not.toContain('create_category');
      const listed = await callTool(first.body.access_token, 'list_transactions');
      expect(listed.isError).toBe(false);
      expect(listed.text).not.toContain('Other Coffee');

      const second = await refresh(first.body.refresh_token).expect(200);
      expect(second.body.refresh_token).not.toBe(first.body.refresh_token);
      await rpc(second.body.access_token, 'tools/list').expect(200);

      const replay = await refresh(first.body.refresh_token).expect(400);
      expect(replay.body.error).toBe('invalid_grant');
      // The replay revoked the grant: the newest tokens are dead too.
      await rpc(second.body.access_token, 'tools/list').expect(401);
      expect((await refresh(second.body.refresh_token).expect(400)).body.error).toBe('invalid_grant');

      const events = await dataSource.getRepository(AuditEvent).find({
        where: { workspaceId: owner.workspaceId, actorId: member.userId },
      });
      const oauth = events.filter(event => event.meta?.kind === 'mcp_oauth');
      expect(oauth.map(event => event.action)).toEqual(expect.arrayContaining(['create', 'delete']));
      expect(oauth.find(event => event.action === 'delete')?.meta?.reason).toBe('refresh_reuse');
      expect(JSON.stringify(oauth)).not.toMatch(/mcp_(at|rt|ac)_/);
    });

    it('stores tokens only as hashes', async () => {
      const { access_token, refresh_token } = await connect(owner, readScopes);
      const rows = await dataSource.query(
        `SELECT t::text AS row FROM mcp_oauth_tokens t
           JOIN mcp_oauth_grants g ON g.id = t.grant_id WHERE g.workspace_id = $1`,
        [owner.workspaceId],
      );
      const dump = JSON.stringify(rows);
      expect(dump).not.toContain(access_token);
      expect(dump).not.toContain(refresh_token);
      expect(dump).toContain(createHash('sha256').update(access_token).digest('hex'));
    });

    it('burns a code on a wrong verifier, and a second exchange revokes the grant', async () => {
      const wrong = await approve(owner, readScopes);
      expect((await exchange(wrong.code, pkcePair().verifier).expect(400)).body.error).toBe(
        'invalid_grant',
      );
      expect((await exchange(wrong.code, wrong.verifier).expect(400)).body.error).toBe(
        'invalid_grant',
      );

      const { code, verifier } = await approve(owner, readScopes);
      const tokens = (await exchange(code, verifier).expect(200)).body;
      expect((await exchange(code, verifier).expect(400)).body.error).toBe('invalid_grant');
      await rpc(tokens.access_token, 'tools/list').expect(401);
      const grant = await dataSource.getRepository(McpOAuthGrant).findOne({
        where: { workspaceId: owner.workspaceId, revokedReason: 'code_reuse' },
      });
      expect(grant?.revokedAt).toBeTruthy();
    });

    it('binds a code to its client, redirect URI and resource', async () => {
      const second = await register({ client_name: 'ACME Other', redirect_uris: [REDIRECT] }).expect(
        201,
      );
      for (const extra of [
        { client_id: second.body.client_id },
        { redirect_uri: 'http://127.0.0.1:33418/callback/' },
      ]) {
        const { code, verifier } = await approve(owner, readScopes);
        expect((await exchange(code, verifier, extra).expect(400)).body.error).toBe('invalid_grant');
      }
      const { code, verifier } = await approve(owner, readScopes);
      expect(
        (await exchange(code, verifier, { resource: 'https://evil.example.com/mcp' }).expect(400))
          .body.error,
      ).toBe('invalid_target');
      const unknown = await exchange(code, verifier, {
        client_id: '00000000-0000-4000-8000-000000000000',
      }).expect(401);
      expect(unknown.body.error).toBe('invalid_client');
      expect((await form('/oauth/token', { grant_type: 'password' }).expect(400)).body.error).toBe(
        'unsupported_grant_type',
      );
    });

    it('expires a code after its minute', async () => {
      const { code, verifier } = await approve(owner, readScopes);
      await dataSource.query(
        `UPDATE mcp_oauth_codes SET expires_at = now() - interval '1 second' WHERE code_hash = $1`,
        [createHash('sha256').update(code).digest('hex')],
      );
      expect((await exchange(code, verifier).expect(400)).body.error).toBe('invalid_grant');
    });

    it('expires an access token after its hour', async () => {
      const { access_token } = await connect(owner, readScopes);
      await dataSource.query(
        `UPDATE mcp_oauth_tokens SET expires_at = now() - interval '1 second' WHERE token_hash = $1`,
        [createHash('sha256').update(access_token).digest('hex')],
      );
      await rpc(access_token, 'tools/list').expect(401);
    });
  });

  describe('scopes and workspaces', () => {
    it('refuses a write tool outside the granted scopes, and allows it inside', async () => {
      const reader = await connect(owner, readScopes);
      const refused = await callTool(reader.access_token, 'create_category', {
        name: 'OAuth refused',
        type: 'expense',
      });
      expect(refused.isError).toBe(true);
      expect(refused.text).toMatch(/scope missing: category\.create/);

      const writer = await connect(owner, writeScopes);
      const created = await callTool(writer.access_token, 'create_category', {
        name: 'OAuth created',
        type: 'expense',
      });
      expect(created.isError).toBe(false);
      const event = await dataSource.getRepository(AuditEvent).findOne({
        where: { workspaceId: owner.workspaceId, entityType: 'category' as never },
        order: { createdAt: 'DESC' },
      });
      expect(event?.actorLabel).toBe('Connected app "ACME Assistant"');
    });

    it('narrows an access token on refresh, and only that token', async () => {
      const writer = await connect(owner, writeScopes);
      const scoped = (refreshToken: string, scope: string) =>
        form('/oauth/token', {
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
          client_id: clientId,
          scope,
        });
      expect((await scoped(writer.refresh_token, 'category.create budget.manage').expect(400)).body.error).toBe(
        'invalid_scope',
      );
      const narrow = await scoped(writer.refresh_token, 'category.view transaction.view').expect(200);
      expect(narrow.body.scope).toBe(readScopes.join(' '));
      const refused = await callTool(narrow.body.access_token, 'create_category', {
        name: 'OAuth narrowed',
        type: 'expense',
      });
      expect(refused.text).toMatch(/scope missing: category\.create/);
      // The grant keeps its scopes: the next refresh without `scope` gets them all back.
      const full = await refresh(narrow.body.refresh_token).expect(200);
      expect(full.body.scope).toBe(writeScopes.join(' '));
      const created = await callTool(full.body.access_token, 'create_category', {
        name: 'OAuth widened again',
        type: 'expense',
      });
      expect(created.isError).toBe(false);
    });

    it('limits a grant to its workspace whatever header comes along', async () => {
      const { access_token } = await connect(owner, readScopes);
      const page = await request(server())
        .post('/mcp')
        .set('Authorization', `Bearer ${access_token}`)
        .set('x-workspace-id', other.workspaceId)
        .set('Accept', 'application/json, text/event-stream')
        .send({
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/call',
          params: { name: 'list_transactions', arguments: {} },
        })
        .expect(200);
      expect(page.text).not.toContain('Other Coffee');
      const foreign = await callTool(access_token, 'get_transaction', { id: otherTransactionId });
      expect(foreign.isError).toBe(true);
      expect(JSON.parse(foreign.text).status).toBe(404);
    });
  });

  describe('access ends', () => {
    it('when the person leaves the workspace', async () => {
      const tokens = await connect(member, readScopes, owner.workspaceId);
      await as(owner, request(server()).delete(`/workspaces/${owner.workspaceId}/members/${member.userId}`))
        .expect(succeeded);
      try {
        await rpc(tokens.access_token, 'tools/list').expect(401);
        expect((await refresh(tokens.refresh_token).expect(400)).body.error).toBe('invalid_grant');
        expect(
          await dataSource.getRepository(McpOAuthGrant).countBy({ userId: member.userId }),
        ).toBe(0);
      } finally {
        await dataSource.getRepository(WorkspaceMember).save({
          workspaceId: owner.workspaceId,
          userId: member.userId,
          role: WorkspaceRole.MEMBER,
        });
      }
      // Coming back is a new membership: the old grant stays gone.
      await rpc(tokens.access_token, 'tools/list').expect(401);
    });

    it('when the role is lowered, for good', async () => {
      const tokens = await connect(member, readScopes, owner.workspaceId);
      await rpc(tokens.access_token, 'tools/list').expect(200);
      await as(
        owner,
        request(server()).patch(`/workspaces/${owner.workspaceId}/members/${member.userId}/role`),
      )
        .send({ role: 'viewer' })
        .expect(succeeded);
      try {
        await rpc(tokens.access_token, 'tools/list').expect(401);
        expect((await refresh(tokens.refresh_token).expect(400)).body.error).toBe('invalid_grant');
      } finally {
        await as(
          owner,
          request(server()).patch(`/workspaces/${owner.workspaceId}/members/${member.userId}/role`),
        )
          .send({ role: 'member' })
          .expect(succeeded);
      }
      await rpc(tokens.access_token, 'tools/list').expect(401);
      const grant = await dataSource.getRepository(McpOAuthGrant).findOne({
        where: { userId: member.userId, revokedReason: 'role_changed' },
      });
      expect(grant?.revokedAt).toBeTruthy();
    });

    it('when the role is lowered before the code is exchanged', async () => {
      const { code, verifier } = await approve(member, readScopes, owner.workspaceId);
      await dataSource
        .getRepository(WorkspaceMember)
        .update({ workspaceId: owner.workspaceId, userId: member.userId }, { role: WorkspaceRole.VIEWER });
      try {
        expect((await exchange(code, verifier).expect(400)).body.error).toBe('invalid_grant');
      } finally {
        await dataSource
          .getRepository(WorkspaceMember)
          .update({ workspaceId: owner.workspaceId, userId: member.userId }, { role: WorkspaceRole.MEMBER });
      }
    });

    it('when the MCP plugin is turned off, until it is on again', async () => {
      const { access_token } = await connect(owner, readScopes);
      await setPlugin(owner, owner.workspaceId, false);
      try {
        const res = await rpc(access_token, 'tools/list').expect(403);
        expect(res.body.error.code).toBe('PLUGIN_DISABLED');
      } finally {
        await setPlugin(owner, owner.workspaceId, true);
      }
      await rpc(access_token, 'tools/list').expect(200);
    });

    it('when the workspace is deleted', async () => {
      const created = await as(owner, request(server()).post('/workspaces'))
        .send({ name: 'OAuth doomed' })
        .expect(201);
      const workspaceId = created.body.id;
      await setPlugin(owner, workspaceId, true);
      const tokens = await connect(owner, readScopes, workspaceId);
      await rpc(tokens.access_token, 'tools/list').expect(200);
      await as(owner, request(server()).delete(`/workspaces/${workspaceId}`), owner.workspaceId).expect(
        succeeded,
      );
      await rpc(tokens.access_token, 'tools/list').expect(401);
      expect((await refresh(tokens.refresh_token).expect(400)).body.error).toBe('invalid_grant');
    });

    it('when the account is deactivated, new tokens included', async () => {
      const { access_token, refresh_token } = await connect(member, readScopes, owner.workspaceId);
      const pending = await approve(member, readScopes, owner.workspaceId);
      await dataSource.getRepository(User).update({ id: member.userId }, { isActive: false });
      try {
        await rpc(access_token, 'tools/list').expect(401);
        expect((await refresh(refresh_token).expect(400)).body.error).toBe('invalid_grant');
        expect((await exchange(pending.code, pending.verifier).expect(400)).body.error).toBe(
          'invalid_grant',
        );
      } finally {
        await dataSource.getRepository(User).update({ id: member.userId }, { isActive: true });
      }
    });

    it('when the client revokes a token (RFC 7009)', async () => {
      const tokens = await connect(owner, readScopes);
      await form('/oauth/revoke', { token: tokens.refresh_token, client_id: clientId }).expect(200);
      await rpc(tokens.access_token, 'tools/list').expect(401);
      await form('/oauth/revoke', { token: 'mcp_rt_unknown', client_id: clientId }).expect(200);
      await form('/oauth/revoke', { client_id: clientId }).expect(400);
    });

    it('not when another client asks to revoke it', async () => {
      const tokens = await connect(owner, readScopes);
      const second = await register({ client_name: 'ACME Third', redirect_uris: [REDIRECT] }).expect(201);
      await form('/oauth/revoke', {
        token: tokens.access_token,
        client_id: second.body.client_id,
      }).expect(200);
      await rpc(tokens.access_token, 'tools/list').expect(200);
    });

    it('when the person disconnects the app from Connected apps', async () => {
      const tokens = await connect(member, readScopes, owner.workspaceId);
      const grant = await grantOf(tokens.access_token);
      const mine = await as(member, request(server()).get('/mcp-oauth/grants'), owner.workspaceId).expect(
        200,
      );
      expect(mine.body.find((row: { id: string }) => row.id === grant?.id)).toMatchObject({
        clientName: 'ACME Assistant',
        redirectHosts: ['127.0.0.1:33418'],
        scopes: readScopes,
      });
      const theirs = await as(owner, request(server()).get('/mcp-oauth/grants')).expect(200);
      expect(theirs.body.map((row: { id: string }) => row.id)).not.toContain(grant?.id);
      await as(owner, request(server()).delete(`/mcp-oauth/grants/${grant?.id}`)).expect(404);
      await as(other, request(server()).delete(`/mcp-oauth/grants/${grant?.id}`)).expect(404);
      await rpc(tokens.access_token, 'tools/list').expect(200);

      await as(member, request(server()).delete(`/mcp-oauth/grants/${grant?.id}`), owner.workspaceId)
        .expect(204);
      await rpc(tokens.access_token, 'tools/list').expect(401);
      const event = await dataSource.getRepository(AuditEvent).findOne({
        where: { entityId: grant?.id, action: 'delete' as never },
      });
      expect(event?.meta).toMatchObject({ kind: 'mcp_oauth', reason: 'user' });
    });
  });

  it('keeps grants out of backups and versions', async () => {
    await connect(owner, readScopes);
    const snapshot = await app.get(BackupDataService).collect(owner.workspaceId);
    const tables = Object.keys(snapshot.collections);
    expect(tables).toContain('categories');
    expect(tables.filter(table => table.startsWith('mcp_oauth'))).toEqual([]);
  });

  it('works with the official MCP client from discovery to a tool call', async () => {
    const http = app.getHttpServer();
    if (!http.listening) {
      await new Promise<void>(resolve => http.listen(0, '127.0.0.1', resolve));
    }
    const local = `http://127.0.0.1:${(http.address() as AddressInfo).port}`;
    // What the frontend's rewrites do in a real deployment.
    const proxied = (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input instanceof Request ? input.url : input)
        .replace(`${ORIGIN}/.well-known/oauth-protected-resource/api/v1/mcp`, `${local}/oauth/protected-resource`)
        .replace(`${ORIGIN}/.well-known/oauth-authorization-server`, `${local}/oauth/authorization-server`)
        .replace(`${ORIGIN}/api/v1/`, `${local}/`);
      return fetch(url, init);
    };
    const store: {
      client?: OAuthClientInformationMixed;
      tokens?: OAuthTokens;
      verifier?: string;
      authorizeUrl?: URL;
    } = {};
    const provider: OAuthClientProvider = {
      redirectUrl: REDIRECT,
      clientMetadata: { client_name: 'ACME SDK Client', redirect_uris: [REDIRECT] },
      clientInformation: () => store.client,
      saveClientInformation: info => {
        store.client = info;
      },
      tokens: () => store.tokens,
      saveTokens: tokens => {
        store.tokens = tokens;
      },
      redirectToAuthorization: url => {
        store.authorizeUrl = url;
      },
      saveCodeVerifier: verifier => {
        store.verifier = verifier;
      },
      codeVerifier: () => store.verifier as string,
    };

    expect(await auth(provider, { serverUrl: RESOURCE, fetchFn: proxied })).toBe('REDIRECT');
    const asked = store.authorizeUrl as URL;
    expect(asked.origin + asked.pathname).toBe(`${ORIGIN}/oauth/authorize`);
    const param = (name: string) => asked.searchParams.get(name) ?? undefined;
    const decision = await as(owner, request(server()).post('/oauth/consent'))
      .send({
        clientId: param('client_id'),
        redirectUri: param('redirect_uri'),
        responseType: param('response_type'),
        codeChallenge: param('code_challenge'),
        codeChallengeMethod: param('code_challenge_method'),
        state: param('state'),
        resource: param('resource'),
        approve: true,
        workspaceId: owner.workspaceId,
        scopes: readScopes,
      })
      .expect(200);
    const code = new URL(decision.body.redirectTo).searchParams.get('code') as string;
    expect(await auth(provider, { serverUrl: RESOURCE, authorizationCode: code, fetchFn: proxied })).toBe(
      'AUTHORIZED',
    );

    const client = new Client({ name: 'e2e-oauth-client', version: '0' });
    const transport = new StreamableHTTPClientTransport(new URL(`${local}/mcp`), {
      requestInit: { headers: { Authorization: `Bearer ${store.tokens?.access_token}` } },
    });
    await client.connect(transport);
    const { tools } = await client.listTools();
    await client.close();
    expect(tools.map(tool => tool.name)).toContain('list_transactions');
  });
});
