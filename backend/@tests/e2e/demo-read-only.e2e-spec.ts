import { type INestApplication, RequestMethod, ValidationPipe } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { DiscoveryService, Reflector } from '@nestjs/core';
import type { TestingModule } from '@nestjs/testing';
import { Schema } from 'effect';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { ALLOW_IN_DEMO_KEY } from '../../src/common/decorators/allow-in-demo.decorator';
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
      const allowed = [ALLOW_IN_DEMO_KEY, ALLOW_IN_VERSION_KEY].some(key =>
        reflector.getAllAndOverride<boolean>(key, [handler, type]),
      );
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
