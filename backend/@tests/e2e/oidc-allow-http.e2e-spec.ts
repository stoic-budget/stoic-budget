import { type INestApplication, Logger } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { deleteUserByEmail, type E2eAccount, e2eTestingModule, registerAccount } from './helpers/e2e-app';
import { MockOidcProvider } from './helpers/mock-oidc-provider';
import { APP_ORIGIN, configureProvider } from './helpers/oidc-flow';

/**
 * A provider on a private network, reached over plain http, saved while the
 * server runs in production: refused unless OIDC_ALLOW_HTTP=true, and then
 * saved and usable with one warning in the log.
 */
describe('OIDC_ALLOW_HTTP in production (e2e)', () => {
  const stamp = Date.now();
  const adminEmail = `oidc-http-admin-${stamp}@example.com`;
  const previous = {
    appUrl: process.env.APP_URL,
    nodeEnv: process.env.NODE_ENV,
    allow: process.env.OIDC_ALLOW_HTTP,
  };
  let app: INestApplication;
  let dataSource: DataSource;
  let provider: MockOidcProvider;
  let admin: E2eAccount;

  const inProduction = async <T>(allow: string | undefined, run: () => Promise<T>): Promise<T> => {
    process.env.NODE_ENV = 'production';
    if (allow === undefined) delete process.env.OIDC_ALLOW_HTTP;
    else process.env.OIDC_ALLOW_HTTP = allow;
    try {
      return await run();
    } finally {
      process.env.NODE_ENV = previous.nodeEnv;
      if (previous.allow === undefined) delete process.env.OIDC_ALLOW_HTTP;
      else process.env.OIDC_ALLOW_HTTP = previous.allow;
    }
  };

  beforeAll(async () => {
    process.env.APP_URL = APP_ORIGIN;
    provider = await new MockOidcProvider().start();
    const moduleFixture = await e2eTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    await app.init();
    dataSource = moduleFixture.get(DataSource);
    admin = await registerAccount(app, adminEmail, 'Admin One');
    await dataSource.query('UPDATE users SET role = $1 WHERE id = $2', ['admin', admin.userId]);
  });

  afterAll(async () => {
    vi.restoreAllMocks();
    await dataSource.query(`DELETE FROM instance_settings WHERE key = 'oidc'`);
    await deleteUserByEmail(dataSource, adminEmail);
    await app.close();
    await provider.close();
    process.env.APP_URL = previous.appUrl;
  });

  it('refuses an http provider in production without the opt-in', async () => {
    for (const allow of [undefined, 'false']) {
      const res = await inProduction(allow, () => configureProvider(app, admin.token, provider));
      expect(res.status).toBe(400);
      expect(res.body.error?.code ?? res.body.code).toBe('OIDC_ISSUER_INSECURE');
    }
    const [row] = await dataSource.query(`SELECT 1 FROM instance_settings WHERE key = 'oidc'`);
    expect(row).toBeUndefined();
  });

  it('saves and uses it with OIDC_ALLOW_HTTP=true, warning once', async () => {
    const warn = vi.spyOn(Logger.prototype, 'warn');
    const saved = await inProduction('true', () => configureProvider(app, admin.token, provider));
    expect(saved.status).toBe(200);
    const started = await inProduction('true', () =>
      request(app.getHttpServer()).post('/auth/oidc/start').send({}),
    );
    expect(started.status).toBe(200);
    expect(started.body.url).toContain(`${provider.issuer}/authorize?`);
    const warnings = warn.mock.calls.filter(([message]) => String(message).includes('plain http'));
    expect(warnings).toHaveLength(1);
    expect(String(warnings[0][0])).toContain(provider.issuer);
    // Credentials in the address stay refused with the opt-in.
    const withUser = provider.issuer.replace('http://', 'http://user:secret@');
    const refused = await inProduction('true', () =>
      configureProvider(app, admin.token, provider, { issuer: withUser }),
    );
    expect(refused.status).toBe(400);
  });
});
