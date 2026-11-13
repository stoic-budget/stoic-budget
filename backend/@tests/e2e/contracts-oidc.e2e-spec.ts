import type { INestApplication } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { Schema } from 'effect';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import {
  LoginResponse,
  OidcIdentityList,
  OidcAuthorization,
  OidcPublicStatus,
  OidcSettingsStatus,
} from '../../src/contracts';
import {
  deleteUserByEmail,
  type E2eAccount,
  e2eTestingModule,
  registerAccount,
  responseCookie,
} from './helpers/e2e-app';
import { MockOidcProvider } from './helpers/mock-oidc-provider';
import {
  ACCOUNT_PASSWORD,
  APP_ORIGIN,
  callback,
  complete,
  configureProvider,
  startLink,
  startLogin,
} from './helpers/oidc-flow';

/** The single sign-on answers, each decoded by its contract with data in it. */
describe('Single sign-on contracts (e2e)', () => {
  const stamp = Date.now();
  const adminEmail = `contracts-oidc-${stamp}@example.com`;
  const previousAppUrl = process.env.APP_URL;
  let app: INestApplication;
  let dataSource: DataSource;
  let provider: MockOidcProvider;
  let admin: E2eAccount;

  const decode = <S extends Schema.Top>(schema: S, body: unknown) =>
    Schema.decodeUnknownSync(schema as unknown as Schema.Codec<S['Type'], unknown>)(body);
  const as = (method: 'get' | 'delete', url: string) =>
    request(app.getHttpServer())[method](url).set('Authorization', `Bearer ${admin.token}`);

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
    await dataSource.query(`DELETE FROM instance_settings WHERE key = 'oidc'`);
    await deleteUserByEmail(dataSource, adminEmail);
    await app.close();
    await provider.close();
    process.env.APP_URL = previousAppUrl;
  });

  it('instance settings and the public status', async () => {
    const saved = await configureProvider(app, admin.token, provider);
    expect(saved.status).toBe(200);
    expect(decode(OidcSettingsStatus, saved.body)).toMatchObject({
      configured: true,
      enabled: true,
      clientSecretSet: true,
      buttonLabel: 'ACME Login',
      allowedDomains: [],
    });
    expect(JSON.stringify(saved.body)).not.toContain(provider.clientSecret);
    decode(OidcSettingsStatus, (await as('get', '/settings/instance/oidc').expect(200)).body);
    const status = await request(app.getHttpServer()).get('/auth/oidc/status').expect(200);
    expect(decode(OidcPublicStatus, status.body)).toEqual({ enabled: true, buttonLabel: 'ACME Login' });
  });

  it('linking, the identity list, sign-in and unlinking', async () => {
    const link = await request(app.getHttpServer())
      .post('/auth/oidc/link')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ password: ACCOUNT_PASSWORD })
      .expect(200);
    expect(decode(OidcAuthorization, link.body).url).toContain(`${provider.issuer}/authorize?`);
    const start = await request(app.getHttpServer()).post('/auth/oidc/start').send({ next: '/reports' }).expect(200);
    expect(decode(OidcAuthorization, start.body).url).toContain('code_challenge_method=S256');
    const flow = await startLink(app, admin.token);
    await callback(app, flow, provider.authorize(flow.location, `contracts-${stamp}`)).then(res =>
      expect(res.status).toBe(302),
    );

    const list = decode(OidcIdentityList, (await as('get', '/auth/oidc/identities').expect(200)).body);
    expect(list).toMatchObject({ passwordSet: true, providerEnabled: true, buttonLabel: 'ACME Login' });
    expect(list.identities).toEqual([
      expect.objectContaining({ issuer: provider.issuer, email: `contracts-${stamp}@example.com`, lastUsedAt: null }),
    ]);

    const login = await startLogin(app);
    const back = await callback(app, login, provider.authorize(login.location, `contracts-${stamp}`));
    const signedIn = await complete(app, responseCookie(back, 'oidc_ticket'));
    expect(signedIn.status).toBe(200);
    expect(decode(LoginResponse, signedIn.body)).toMatchObject({ user: { id: admin.userId } });
    const used = decode(OidcIdentityList, (await as('get', '/auth/oidc/identities').expect(200)).body);
    expect(used.identities[0].lastUsedAt).toEqual(expect.any(String));

    const after = await as('delete', `/auth/oidc/identities/${list.identities[0].id}`).expect(200);
    expect(decode(OidcIdentityList, after.body).identities).toEqual([]);
  });

  it('the second-factor question and clearing the provider', async () => {
    await dataSource.query('UPDATE users SET two_factor_enabled_at = now() WHERE id = $1', [admin.userId]);
    await dataSource.query(
      `INSERT INTO user_identities (user_id, issuer, subject) VALUES ($1, $2, $3)`,
      [admin.userId, provider.issuer, `contracts-2fa-${stamp}`],
    );
    const login = await startLogin(app);
    const back = await callback(app, login, provider.authorize(login.location, `contracts-2fa-${stamp}`));
    const asked = await complete(app, responseCookie(back, 'oidc_ticket'));
    expect(decode(LoginResponse, asked.body)).toEqual({ twoFactorRequired: true });
    await dataSource.query('UPDATE users SET two_factor_enabled_at = NULL WHERE id = $1', [admin.userId]);

    const cleared = await as('delete', '/settings/instance/oidc').expect(200);
    expect(decode(OidcSettingsStatus, cleared.body)).toMatchObject({ configured: false, clientSecretSet: false });
  });
});
