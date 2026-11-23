vi.mock('franc', () => ({
  franc: () => 'und',
}));

import { type INestApplication, ValidationPipe } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { corsOptionsFor } from '../../src/common/utils/cors-options';
import { resolveAllowedOrigins } from '../../src/common/utils/cors-origins';
import { ACCESS_TOKEN_COOKIE } from '../../src/modules/auth/auth-cookies';
import { deleteUserByEmail, e2eTestingModule, responseCookie } from './helpers/e2e-app';

const APP_ORIGIN = 'https://books.example.com';
const FOREIGN = 'https://inspector.example.net';
const REDIRECT = 'http://127.0.0.1:6274/oauth/callback';

/**
 * CORS as main.ts sets it up: the OAuth routes a browser-based MCP client
 * calls answer any origin without credentials, every other route keeps the
 * credentialed allowlist.
 */
describe('MCP OAuth CORS (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  const saved = { frontend: process.env.FRONTEND_URL, cors: process.env.CORS_ORIGINS };
  const email = `oauth-cors-${Date.now()}@example.com`;
  let sessionToken: string;

  const server = () => app.getHttpServer();
  const preflight = (path: string, origin: string, method: string, headers = 'content-type') =>
    request(server())
      .options(path)
      .set('Origin', origin)
      .set('Access-Control-Request-Method', method)
      .set('Access-Control-Request-Headers', headers);
  const expectOpen = (res: request.Response) => {
    expect(res.headers['access-control-allow-origin']).toBe('*');
    expect(res.headers['access-control-allow-credentials']).toBeUndefined();
  };
  /** No allowed origin, so the browser hides the answer (the cors package sends allow-credentials regardless). */
  const expectClosed = (res: request.Response) => {
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  };

  beforeAll(async () => {
    process.env.FRONTEND_URL = APP_ORIGIN;
    delete process.env.CORS_ORIGINS;
    const moduleFixture: TestingModule = await e2eTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.enableCors(corsOptionsFor(resolveAllowedOrigins()));
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    dataSource = moduleFixture.get(DataSource);
    // Under the global prefix here, so not registerAccount, which posts to /auth/register.
    const res = await request(server())
      .post('/api/v1/auth/register')
      .send({ email, password: 'Test123!@#', name: 'Member One' })
      .expect(201);
    sessionToken = `${ACCESS_TOKEN_COOKIE}=${responseCookie(res, ACCESS_TOKEN_COOKIE)}`;
  });

  afterAll(async () => {
    process.env.FRONTEND_URL = saved.frontend;
    if (saved.cors !== undefined) process.env.CORS_ORIGINS = saved.cors;
    if (dataSource) await deleteUserByEmail(dataSource, email);
    await app.close();
  });

  it.each([
    ['/api/v1/oauth/protected-resource', 'GET', 'mcp-protocol-version'],
    ['/api/v1/oauth/authorization-server', 'GET', 'mcp-protocol-version'],
    ['/api/v1/oauth/register', 'POST', 'content-type'],
    ['/api/v1/oauth/token', 'POST', 'content-type'],
    ['/api/v1/oauth/revoke', 'POST', 'content-type'],
  ])('answers a foreign preflight on %s with only %s and its headers', async (path, method, header) => {
    const res = await preflight(path, FOREIGN, method, header).expect(204);
    expectOpen(res);
    expect(res.headers['access-control-allow-methods']).toBe(method);
    expect(res.headers['access-control-allow-headers']).toBe('Content-Type,MCP-Protocol-Version');
  });

  it('lets a foreign page read discovery, register and use the token endpoint', async () => {
    for (const path of ['/api/v1/oauth/protected-resource', '/api/v1/oauth/authorization-server']) {
      const res = await request(server())
        .get(path)
        .set('Origin', FOREIGN)
        .set('MCP-Protocol-Version', '2025-06-18')
        .expect(200);
      expectOpen(res);
    }
    const registered = await request(server())
      .post('/api/v1/oauth/register')
      .set('Origin', FOREIGN)
      .send({ client_name: 'ACME Inspector', redirect_uris: [REDIRECT] })
      .expect(201);
    expectOpen(registered);
    const token = await request(server())
      .post('/api/v1/oauth/token')
      .set('Origin', FOREIGN)
      .type('form')
      .send({ grant_type: 'refresh_token', refresh_token: 'mcp_rt_x', client_id: registered.body.client_id })
      .expect(400);
    expectOpen(token);
    expect(token.body.error).toBe('invalid_grant');
    const revoked = await request(server())
      .post('/api/v1/oauth/revoke')
      .set('Origin', FOREIGN)
      .type('form')
      .send({ token: 'mcp_rt_x' })
      .expect(200);
    expectOpen(revoked);
  });

  it('answers the token endpoint the same with or without a session cookie', async () => {
    const body = { grant_type: 'authorization_code', code: 'mcp_ac_x', code_verifier: 'x', redirect_uri: REDIRECT, client_id: 'nobody' };
    const bare = await request(server()).post('/api/v1/oauth/token').type('form').send(body);
    const withCookie = await request(server())
      .post('/api/v1/oauth/token')
      .set('Origin', FOREIGN)
      .set('Cookie', sessionToken)
      .type('form')
      .send(body);
    expect(withCookie.status).toBe(bare.status);
    expect(withCookie.body).toEqual(bare.body);
    expectOpen(withCookie);
  });

  it('keeps every other route closed to a foreign origin', async () => {
    for (const path of ['/api/v1/auth/me', '/api/v1/oauth/consent', '/api/v1/mcp-oauth/grants']) {
      expectClosed(await preflight(path, FOREIGN, 'GET'));
      expectClosed(
        await request(server()).get(path).set('Origin', FOREIGN).set('Cookie', sessionToken),
      );
    }
    // Only the exact paths are open: a look-alike falls to the allowlist.
    expectClosed(await request(server()).get('/api/v1/oauth/token/').set('Origin', FOREIGN));
  });

  it('keeps credentialed CORS for the app itself', async () => {
    const res = await preflight('/api/v1/auth/me', APP_ORIGIN, 'GET').expect(204);
    expect(res.headers['access-control-allow-origin']).toBe(APP_ORIGIN);
    expect(res.headers['access-control-allow-credentials']).toBe('true');
    const me = await request(server())
      .get('/api/v1/auth/me')
      .set('Origin', APP_ORIGIN)
      .set('Cookie', sessionToken)
      .expect(200);
    expect(me.headers['access-control-allow-origin']).toBe(APP_ORIGIN);
    expect(me.headers['access-control-allow-credentials']).toBe('true');
  });
});
