import { type INestApplication, RequestMethod, ValidationPipe } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { DiscoveryService, Reflector } from '@nestjs/core';
import type { TestingModule } from '@nestjs/testing';
import { Schema } from 'effect';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import {
  ALLOW_IN_DEMO_KEY,
  REFUSE_IN_DEMO_KEY,
} from '../../src/common/decorators/allow-in-demo.decorator';
import { ALLOW_IN_VERSION_KEY } from '../../src/common/decorators/allow-in-version.decorator';
import { DemoStatus, RegistrationStatus } from '../../src/contracts';
import { accessTokenOf, deleteUserByEmail, e2eTestingModule, registerAccount } from './helpers/e2e-app';

type Route = { method: string; path: string; allowed: boolean };

const WRITE_METHODS: Partial<Record<RequestMethod, string>> = {
  [RequestMethod.POST]: 'post',
  [RequestMethod.PUT]: 'put',
  [RequestMethod.PATCH]: 'patch',
  [RequestMethod.DELETE]: 'delete',
};

const joinPath = (...parts: string[]) =>
  `/${parts
    .flatMap(part => part.split('/'))
    .filter(Boolean)
    .map(segment => (segment.startsWith(':') ? '00000000-0000-4000-8000-000000000000' : segment))
    .join('/')}`;

/** Every write route of the app, with whether it carries a demo allow marker. */
function writeRoutes(app: INestApplication): Route[] {
  const reflector = app.get(Reflector);
  const routes: Route[] = [];
  for (const wrapper of app.get(DiscoveryService).getControllers()) {
    const type = wrapper.metatype as (new (...args: never[]) => unknown) | undefined;
    if (!type) continue;
    const prefixes = ([] as string[]).concat(Reflect.getMetadata(PATH_METADATA, type) ?? '');
    // Descriptors, not property reads: a getter on the prototype would run without an instance.
    for (const [name, descriptor] of Object.entries(
      Object.getOwnPropertyDescriptors(type.prototype),
    )) {
      const handler = descriptor.value;
      if (name === 'constructor' || typeof handler !== 'function') continue;
      const method = WRITE_METHODS[Reflect.getMetadata(METHOD_METADATA, handler) as RequestMethod];
      const paths = Reflect.getMetadata(PATH_METADATA, handler);
      if (!method || paths === undefined) continue;
      const marked = (key: string) => reflector.getAllAndOverride<boolean>(key, [handler, type]);
      const allowed =
        !marked(REFUSE_IN_DEMO_KEY) && [ALLOW_IN_DEMO_KEY, ALLOW_IN_VERSION_KEY].some(marked);
      for (const prefix of prefixes) {
        for (const path of ([] as string[]).concat(paths)) {
          routes.push({ method, path: joinPath(prefix, path), allowed });
        }
      }
    }
  }
  return routes;
}

/**
 * `DEMO_MODE=true`: the instance answers reads and the shared account's
 * sign-in, and refuses every other write, public ones included, before it
 * reaches a handler. A new write route is refused until someone marks it.
 */
describe('Demo instance is read-only (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  const email = `demo-visitor-${Date.now()}@example.com`;
  const password = 'Test123!@#';
  const previous = {
    mode: process.env.DEMO_MODE,
    email: process.env.DEMO_USER_EMAIL,
    password: process.env.DEMO_USER_PASSWORD,
  };
  const server = () => app.getHttpServer();
  const decode = (schema: Schema.Top, body: unknown) =>
    Schema.decodeUnknownSync(schema as Schema.Codec<unknown, unknown>)(body);

  beforeAll(async () => {
    const moduleFixture: TestingModule = await e2eTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    dataSource = moduleFixture.get(DataSource);
    // The account exists before the instance turns into a demo, as the seed script makes it.
    await registerAccount(app, email, 'Demo Visitor');
    process.env.DEMO_MODE = 'true';
    process.env.DEMO_USER_EMAIL = email;
    process.env.DEMO_USER_PASSWORD = password;
  });

  afterAll(async () => {
    for (const [key, value] of [
      ['DEMO_MODE', previous.mode],
      ['DEMO_USER_EMAIL', previous.email],
      ['DEMO_USER_PASSWORD', previous.password],
    ] as const) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    if (dataSource) await deleteUserByEmail(dataSource, email);
    await app.close();
  });

  it('tells the login page it is a demo and which account to offer', async () => {
    const res = await request(server()).get('/auth/demo').expect(200);
    expect(decode(DemoStatus, res.body)).toEqual({ enabled: true, account: { email, password } });
    const registration = await request(server()).get('/auth/registration').expect(200);
    expect(decode(RegistrationStatus, registration.body)).toEqual({ open: false });
  });

  it('refuses every unmarked write route with DEMO_READ_ONLY, signed in or not', async () => {
    const routes = writeRoutes(app);
    const refused = routes.filter(route => !route.allowed);
    // A sanity floor: the walk found the app's routes, not an empty list.
    expect(refused.length).toBeGreaterThan(300);

    const login = await request(server()).post('/auth/login').send({ email, password }).expect(200);
    const token = accessTokenOf(login);
    const answeredOtherwise: string[] = [];
    for (const route of refused) {
      for (const signedIn of [false, true]) {
        let call = request(server())[route.method as 'post'](route.path).send({});
        if (signedIn) call = call.set('Authorization', `Bearer ${token}`);
        const res = await call;
        if (res.status !== 403 || res.body?.error?.code !== 'DEMO_READ_ONLY') {
          answeredOtherwise.push(`${route.method.toUpperCase()} ${route.path} → ${res.status}`);
        }
      }
    }
    expect(answeredOtherwise).toEqual([]);
  });

  it('refuses opening, copying and closing a past version, which @AllowInVersion lets in', async () => {
    const login = await request(server()).post('/auth/login').send({ email, password }).expect(200);
    const token = accessTokenOf(login);
    const version = '00000000-0000-4000-8000-000000000000';
    for (const [method, path] of [
      ['post', `/versions/${version}/open`],
      ['post', `/versions/${version}/copy`],
      ['delete', `/versions/${version}/open`],
    ] as const) {
      const res = await request(server())
        [method](path)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'A copy' })
        .expect(403);
      expect(res.body.error.code).toBe('DEMO_READ_ONLY');
    }
  });

  it("keeps no visitor's address or browser: everyone sees the one account's sessions", async () => {
    const sessionIdOf = (token: string): string =>
      JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString()).sessionId;
    const visitors = [
      { agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130.0', ip: '198.51.100.21' },
      { agent: 'Mozilla/5.0 (Macintosh; Mac OS X 14_0) Safari/605.1.15', ip: '198.51.100.22' },
    ];
    const tokens: string[] = [];
    for (const visitor of visitors) {
      const login = await request(server())
        .post('/auth/login')
        .set('User-Agent', visitor.agent)
        .set('X-Forwarded-For', visitor.ip)
        .send({ email, password })
        .expect(200);
      tokens.push(accessTokenOf(login));
    }

    const stored = await dataSource.query(
      'SELECT ip_address, user_agent, browser, os FROM auth_sessions WHERE id = ANY($1)',
      [tokens.map(sessionIdOf)],
    );
    expect(stored).toEqual(
      visitors.map(() => ({ ip_address: null, user_agent: null, browser: 'Unknown browser', os: 'Unknown OS' })),
    );

    const list = await request(server())
      .get('/auth/sessions')
      .set('Authorization', `Bearer ${tokens[1]}`)
      .expect(200);
    // The account's session from before it became a demo is listed without its origin too.
    expect(list.body.length).toBeGreaterThanOrEqual(visitors.length + 1);
    for (const session of list.body) {
      expect(session).toMatchObject({
        ipAddress: null,
        device: 'Unknown device',
        browser: 'Unknown browser',
        os: 'Unknown OS',
      });
    }
  });

  it('keeps the address and browser of a session off a demo', async () => {
    process.env.DEMO_MODE = 'false';
    try {
      const login = await request(server())
        .post('/auth/login')
        .set('User-Agent', 'Mozilla/5.0 (X11; Linux x86_64) Firefox/131.0')
        .send({ email, password })
        .expect(200);
      const list = await request(server())
        .get('/auth/sessions')
        .set('Authorization', `Bearer ${accessTokenOf(login)}`)
        .expect(200);
      const current = list.body.find((session: { isCurrent: boolean }) => session.isCurrent);
      expect(current).toMatchObject({ browser: 'Firefox', os: 'Linux', ipAddress: expect.any(String) });
    } finally {
      process.env.DEMO_MODE = 'true';
    }
  });

  it('lets the shared account sign in, read, refresh and sign out', async () => {
    const login = await request(server()).post('/auth/login').send({ email, password }).expect(200);
    const token = accessTokenOf(login);
    await request(server()).get('/auth/me').set('Authorization', `Bearer ${token}`).expect(200);
    await request(server()).post('/auth/logout').set('Authorization', `Bearer ${token}`).expect(200);
  });

  it('refuses sign-up and password resets, which are public', async () => {
    for (const [path, body] of [
      ['/auth/register', { email: 'someone@example.com', password, name: 'Someone' }],
      ['/auth/forgot-password', { email }],
    ] as const) {
      const res = await request(server()).post(path).send(body).expect(403);
      expect(res.body.error.code).toBe('DEMO_READ_ONLY');
    }
  });
});
