vi.mock('franc', () => ({
  franc: () => 'und',
}));

import { createHash, randomBytes } from 'node:crypto';
import request from 'supertest';
import {
  McpOAuthConsent,
  McpOAuthGrantList,
  McpOAuthRedirect,
  RegistrationStatus,
} from '../../src/contracts';
import { type ContractApp, startContractApp } from './helpers/contract-app';
import { deleteUserByEmail } from './helpers/e2e-app';

const REDIRECT = 'http://127.0.0.1:33418/callback';

/** The consent screen, Connected apps and the registration switch: answers checked with data. */
describe('API contracts: MCP OAuth (e2e)', () => {
  const email = `contracts-mcp-oauth-${Date.now()}@example.com`;
  const savedFrontendUrl = process.env.FRONTEND_URL;
  let ctx: ContractApp;
  let clientId: string;

  const authorization = () => {
    const verifier = randomBytes(32).toString('base64url');
    return {
      verifier,
      query: {
        clientId,
        redirectUri: REDIRECT,
        responseType: 'code',
        codeChallenge: createHash('sha256').update(verifier).digest('base64url'),
        codeChallengeMethod: 'S256',
        state: 'contract-state',
      },
    };
  };

  beforeAll(async () => {
    process.env.FRONTEND_URL = 'https://books.example.com';
    ctx = await startContractApp(email, 'Member Owner');
    await ctx.dataSource.query(`UPDATE users SET role = 'admin' WHERE id = $1`, [ctx.owner.userId]);
    await ctx.call('patch', `/workspaces/${ctx.owner.workspaceId}`, { plugins: { mcp: true } }).expect(200);
    const registered = await request(ctx.app.getHttpServer())
      .post('/oauth/register')
      .send({ client_name: 'ACME Assistant', redirect_uris: [REDIRECT] })
      .expect(201);
    clientId = registered.body.client_id;
  });

  afterAll(async () => {
    process.env.FRONTEND_URL = savedFrontendUrl;
    await deleteUserByEmail(ctx.dataSource, email);
    await ctx.app.close();
  });

  it('consent, both answers', async () => {
    const { query } = authorization();
    const consent = await ctx.answer(
      McpOAuthConsent,
      ctx.call('get', '/oauth/consent').query({ ...query, scope: 'transaction.view' }),
    );
    expect(consent.kind).toBe('consent');
    if (consent.kind === 'consent') {
      expect(consent.workspaces.length).toBeGreaterThan(0);
      expect(consent.workspaces[0].write.length).toBeGreaterThan(0);
      expect(consent.requestedScopes).toEqual(['transaction.view']);
    }
    const back = await ctx.answer(
      McpOAuthConsent,
      ctx.call('get', '/oauth/consent').query({ ...query, codeChallengeMethod: 'plain' }),
    );
    expect(back.kind).toBe('redirect');
  });

  it('decision and connected apps', async () => {
    const { query, verifier } = authorization();
    const decided = await ctx.answer(
      McpOAuthRedirect,
      ctx.call('post', '/oauth/consent', {
        ...query,
        approve: true,
        workspaceId: ctx.owner.workspaceId,
        scopes: ['transaction.view'],
      }),
    );
    const code = new URL(decided.redirectTo).searchParams.get('code') as string;
    await request(ctx.app.getHttpServer())
      .post('/oauth/token')
      .type('form')
      .send({
        grant_type: 'authorization_code',
        code,
        code_verifier: verifier,
        redirect_uri: REDIRECT,
        client_id: clientId,
      })
      .expect(200);

    const apps = await ctx.answer(McpOAuthGrantList, ctx.call('get', '/mcp-oauth/grants'));
    expect(apps).toHaveLength(1);
    expect(apps[0].clientName).toBe('ACME Assistant');
    expect(apps[0].lastUsedAt).toBeNull();
  });

  it('registration switch', async () => {
    const status = await ctx.answer(
      RegistrationStatus,
      ctx.call('get', '/settings/instance/mcp-oauth-registration'),
    );
    expect(status.open).toBe(true);
    await ctx.answer(
      RegistrationStatus,
      ctx.call('put', '/settings/instance/mcp-oauth-registration', { open: true }),
    );
  });
});
