import type { INestApplication } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import { generateSync } from 'otplib';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import {
  deleteUserByEmail,
  type E2eAccount,
  e2eTestingModule,
  registerAccount,
  responseCookie,
} from './helpers/e2e-app';
import { MockOidcProvider } from './helpers/mock-oidc-provider';
import {
  APP_ORIGIN,
  callback,
  complete,
  configureProvider,
  landing,
  seenAnswers,
  signIn,
  startLink,
  startLogin,
} from './helpers/oidc-flow';

describe('Sign-in through an OpenID Connect provider (e2e)', () => {
  const stamp = Date.now();
  const sub = (name: string) => `oidc-${name}-${stamp}`;
  const adminEmail = `oidc-admin-${stamp}@example.com`;
  const memberEmail = `oidc-member-${stamp}@example.com`;
  const otherEmail = `oidc-other-${stamp}@example.com`;
  const createdEmails: string[] = [];
  const previousAppUrl = process.env.APP_URL;
  let app: INestApplication;
  let dataSource: DataSource;
  let provider: MockOidcProvider;
  let admin: E2eAccount;
  let member: E2eAccount;
  let other: E2eAccount;

  const errorOf = (res: request.Response) => landing(res).searchParams.get('oidcError');
  const as = (account: E2eAccount) => ({
    get: (url: string) =>
      request(app.getHttpServer()).get(url).set('Authorization', `Bearer ${account.token}`),
    del: (url: string) =>
      request(app.getHttpServer()).delete(url).set('Authorization', `Bearer ${account.token}`),
  });
  const configure = (overrides: Record<string, unknown> = {}) =>
    configureProvider(app, admin.token, provider, overrides).then(res => {
      if (res.status !== 200) throw new Error(`${res.status} ${JSON.stringify(res.body)}`);
      return res;
    });
  const identityRows = (subject: string) =>
    dataSource.query('SELECT user_id FROM user_identities WHERE subject = $1', [subject]);
  const oidcEvents = (userId: string) =>
    dataSource.query(
      `SELECT action, severity, meta, diff FROM audit_events
        WHERE entity_id = $1 AND meta ? 'oidcEvent' ORDER BY created_at`,
      [userId],
    );
  /** Links `subject` to `account` through the settings flow. */
  const link = async (account: E2eAccount, subject: string) => {
    const flow = await startLink(app, account.token);
    return callback(app, flow, provider.authorize(flow.location, subject));
  };

  beforeAll(async () => {
    process.env.APP_URL = APP_ORIGIN;
    provider = await new MockOidcProvider().start();
    const moduleFixture: TestingModule = await e2eTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    // As main.ts does: the flow and ticket cookies are read from req.cookies.
    app.use(cookieParser());
    await app.init();
    dataSource = moduleFixture.get(DataSource);
    admin = await registerAccount(app, adminEmail, 'Admin One');
    member = await registerAccount(app, memberEmail, 'Member One');
    other = await registerAccount(app, otherEmail, 'Member Two');
    await dataSource.query('UPDATE users SET role = $1 WHERE id = $2', ['admin', admin.userId]);
    await configure();
  });

  afterAll(async () => {
    await dataSource.query(`DELETE FROM instance_settings WHERE key IN ('oidc', 'registration')`);
    for (const email of [adminEmail, memberEmail, otherEmail, ...createdEmails]) {
      await deleteUserByEmail(dataSource, email);
    }
    await app.close();
    await provider.close();
    process.env.APP_URL = previousAppUrl;
  });

  describe('instance settings', () => {
    it('lets only an instance admin read or change the provider', async () => {
      await as(member).get('/settings/instance/oidc').expect(403);
      await configureProvider(app, member.token, provider).then(res => expect(res.status).toBe(403));
      await request(app.getHttpServer()).get('/settings/instance/oidc').expect(401);
    });

    it('stores the client secret encrypted and only says whether it is set', async () => {
      const saved = await as(admin).get('/settings/instance/oidc').expect(200);
      expect(saved.body).toMatchObject({ enabled: true, clientSecretSet: true, issuer: provider.issuer });
      expect(saved.body.redirectUri).toBe(`${APP_ORIGIN}/api/v1/auth/oidc/callback`);
      const [row] = await dataSource.query(
        `SELECT encrypted_secrets FROM instance_settings WHERE key = 'oidc'`,
      );
      expect(row.encrypted_secrets.clientSecret).toMatch(/^enc:/);
      expect(JSON.stringify(row)).not.toContain(provider.clientSecret);

      // Saving without a secret keeps the stored one.
      const kept = await configure({ clientSecret: null });
      expect(kept.body.clientSecretSet).toBe(true);
      const events = await oidcEvents(admin.userId);
      expect(events.length).toBeGreaterThan(0);
      expect(events.at(-1).meta).toMatchObject({ oidcEvent: 'settings_changed' });
      expect(JSON.stringify(events)).not.toContain(provider.clientSecret);
    });

    it('takes the same save twice at once', async () => {
      await dataSource.query(`DELETE FROM instance_settings WHERE key = 'oidc'`);
      const results = await Promise.all([
        configureProvider(app, admin.token, provider),
        configureProvider(app, admin.token, provider),
      ]);
      expect(results.map(res => res.status)).toEqual([200, 200]);
      const rows = await dataSource.query(`SELECT id FROM instance_settings WHERE key = 'oidc'`);
      expect(rows).toHaveLength(1);
    });

    it('refuses an issuer whose discovery names another one', async () => {
      provider.advertisedIssuer = 'https://elsewhere.example.com';
      try {
        const res = await configureProvider(app, admin.token, provider, { issuer: `${provider.issuer}/` });
        expect(res.status).toBe(502);
        expect(res.body.error?.code ?? res.body.code).toBe('OIDC_ISSUER_MISMATCH');
      } finally {
        provider.advertisedIssuer = null;
      }
      await configure();
    });

    it('shows the button only while the provider is on', async () => {
      const on = await request(app.getHttpServer()).get('/auth/oidc/status').expect(200);
      expect(on.body).toEqual({ enabled: true, buttonLabel: 'ACME Login' });
      await configure({ enabled: false });
      const off = await request(app.getHttpServer()).get('/auth/oidc/status').expect(200);
      expect(off.body.enabled).toBe(false);
      const refused = await request(app.getHttpServer()).post('/auth/oidc/start').send({}).expect(404);
      expect(refused.body.error?.code ?? refused.body.code).toBe('OIDC_DISABLED');
      expect(responseCookie(refused, 'oidc_flow')).toBeUndefined();
      await configure();
    });
  });

  describe('linking from security settings', () => {
    it('links a provider account to the signed-in user, then signs them in with it', async () => {
      const linked = await link(member, sub('member'));
      expect(landing(linked).pathname).toBe('/settings/profile');
      expect(landing(linked).searchParams.get('oidc')).toBe('linked');
      expect(await identityRows(sub('member'))).toEqual([{ user_id: member.userId }]);

      const result = await signIn(app, provider, sub('member'));
      expect(landing(result.callback).searchParams.get('oidc')).toBe('complete');
      expect(result.completed?.status).toBe(200);
      expect(result.completed?.body.user.id).toBe(member.userId);
      const me = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${result.token}`)
        .expect(200);
      expect(me.body.id).toBe(member.userId);

      const events = (await oidcEvents(member.userId)).map((event: { meta: { oidcEvent: string } }) => event.meta.oidcEvent);
      expect(events).toEqual(expect.arrayContaining(['linked', 'sign_in']));
    });

    it('does not move an identity linked to someone else', async () => {
      const res = await link(other, sub('member'));
      expect(landing(res).pathname).toBe('/settings/profile');
      expect(errorOf(res)).toBe('OIDC_IDENTITY_LINKED_ELSEWHERE');
      expect(await identityRows(sub('member'))).toEqual([{ user_id: member.userId }]);
    });

    it('never lets one user unlink another user’s identity', async () => {
      const [{ id }] = await dataSource.query(
        'SELECT id FROM user_identities WHERE subject = $1',
        [sub('member')],
      );
      const res = await as(other).del(`/auth/oidc/identities/${id}`).expect(404);
      expect(res.body.error?.code ?? res.body.code).toBe('OIDC_IDENTITY_NOT_FOUND');
      expect(await identityRows(sub('member'))).toHaveLength(1);
    });
  });

  describe('a first sign-in', () => {
    it('does not link an existing account by its e-mail', async () => {
      const result = await signIn(app, provider, sub('lookalike'), { claims: { email: memberEmail } });
      expect(errorOf(result.callback)).toBe('OIDC_ACCOUNT_EXISTS');
      expect(result.completed).toBeNull();
      expect(await identityRows(sub('lookalike'))).toEqual([]);
      const events = await oidcEvents(member.userId);
      expect(events.at(-1).meta).toMatchObject({ oidcEvent: 'refused', reason: 'OIDC_ACCOUNT_EXISTS' });
    });

    it('creates no account unless the admin allows it', async () => {
      const result = await signIn(app, provider, sub('stranger'));
      expect(errorOf(result.callback)).toBe('OIDC_SIGNUP_NOT_ALLOWED');
      expect(await identityRows(sub('stranger'))).toEqual([]);
    });

    it('creates an account when allowed, without a usable password', async () => {
      await configure({ allowSignup: true, allowedDomains: ['example.com'] });
      createdEmails.push(`${sub('newcomer')}@example.com`);
      const result = await signIn(app, provider, sub('newcomer'));
      expect(result.completed?.status).toBe(200);
      const user = result.completed?.body.user;
      expect(user.email).toBe(`${sub('newcomer')}@example.com`);
      expect(user.workspaceId).toEqual(expect.any(String));
      const [row] = await dataSource.query('SELECT password_set FROM users WHERE id = $1', [user.id]);
      expect(row.password_set).toBe(false);
      const password = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: user.email, password: 'Test123!@#' });
      expect(password.status).toBe(401);
    });

    it('still refuses when sign-up on the server is closed', async () => {
      await request(app.getHttpServer())
        .put('/settings/instance/registration')
        .set('Authorization', `Bearer ${admin.token}`)
        .send({ open: false })
        .expect(200);
      try {
        const result = await signIn(app, provider, sub('closed'));
        expect(errorOf(result.callback)).toBe('OIDC_SIGNUP_NOT_ALLOWED');
      } finally {
        await dataSource.query(`DELETE FROM instance_settings WHERE key = 'registration'`);
      }
    });

    it('refuses an e-mail domain the admin did not allow', async () => {
      const result = await signIn(app, provider, sub('outsider'), {
        claims: { email: `${sub('outsider')}@example.co.il` },
      });
      expect(errorOf(result.callback)).toBe('OIDC_DOMAIN_NOT_ALLOWED');
      expect(await identityRows(sub('outsider'))).toEqual([]);
    });

    it('refuses an e-mail the provider has not verified', async () => {
      for (const email_verified of [false, 'true', undefined]) {
        const result = await signIn(app, provider, sub('unverified'), {
          claims: { email_verified },
        });
        expect(errorOf(result.callback)).toBe('OIDC_EMAIL_NOT_VERIFIED');
      }
      expect(await identityRows(sub('unverified'))).toEqual([]);
    });

    it('makes one account when two first sign-ins race', async () => {
      createdEmails.push(`${sub('racer')}@example.com`);
      const flows = await Promise.all([startLogin(app), startLogin(app)]);
      const results = await Promise.all(
        flows.map(flow => callback(app, flow, provider.authorize(flow.location, sub('racer')))),
      );
      expect(results.map(res => landing(res).searchParams.get('oidc'))).toEqual(['complete', 'complete']);
      expect(await identityRows(sub('racer'))).toHaveLength(1);
      const users = await dataSource.query('SELECT id FROM users WHERE email = $1', [`${sub('racer')}@example.com`]);
      expect(users).toHaveLength(1);
      await configure();
    });
  });

  describe('the state and the ID token', () => {
    it('takes a state once', async () => {
      const flow = await startLogin(app);
      const code = provider.authorize(flow.location, sub('member'));
      const first = await callback(app, flow, code);
      expect(landing(first).searchParams.get('oidc')).toBe('complete');
      const replay = await callback(app, flow, code);
      expect(errorOf(replay)).toBe('OIDC_STATE_INVALID');
    });

    it('refuses a callback from a browser that did not start the sign-in', async () => {
      for (const binding of [null, 'someone-elses-binding']) {
        const flow = await startLogin(app);
        const res = await callback(app, flow, provider.authorize(flow.location, sub('member')), { binding });
        expect(errorOf(res)).toBe('OIDC_STATE_INVALID');
        expect(responseCookie(res, 'oidc_ticket')).toBeUndefined();
      }
    });

    it('refuses an answer that names another issuer (RFC 9207)', async () => {
      const flow = await startLogin(app);
      const code = provider.authorize(flow.location, sub('member'));
      const res = await callback(app, flow, code, { extra: { iss: 'https://elsewhere.example.com' } });
      expect(errorOf(res)).toBe('OIDC_STATE_INVALID');
    });

    it.each([
      ['a wrong nonce', { claims: { nonce: 'not-the-nonce' } }],
      ['no nonce', { omit: ['nonce'] }],
      ['another audience', { claims: { aud: 'someone-else' } }],
      ['another authorized party', { claims: { aud: ['stoic-client', 'other'], azp: 'other' } }],
      ['several audiences and no azp', { claims: { aud: ['stoic-client', 'other'] } }],
      ['another issuer', { claims: { iss: 'https://elsewhere.example.com' } }],
      ['an expired token', { claims: { exp: Math.floor(Date.now() / 1000) - 3600 } }],
      ['a token issued long ago', { claims: { iat: Math.floor(Date.now() / 1000) - 3600 } }],
      ['alg none', { alg: 'none' as const }],
      ['HS256 keyed with the public key', { alg: 'HS256-public' as const }],
    ])('refuses %s', async (_label, shape) => {
      const result = await signIn(app, provider, sub('member'), shape);
      expect(errorOf(result.callback)).toBe('OIDC_TOKEN_INVALID');
      expect(result.completed).toBeNull();
    });

    it('follows a key rotation, fetching the new keys once', async () => {
      provider.rotateKey();
      const before = provider.jwksRequests;
      const result = await signIn(app, provider, sub('member'));
      expect(result.completed?.body.user.id).toBe(member.userId);
      expect(provider.jwksRequests).toBe(before + 1);
    });

    it('goes back only to a path on this site', async () => {
      for (const next of ['//elsewhere.example.com/x', 'https://elsewhere.example.com', '/\\elsewhere']) {
        const flow = await startLogin(app, next);
        const res = await callback(app, flow, provider.authorize(flow.location, sub('member')));
        expect(landing(res).origin).toBe(APP_ORIGIN);
        expect(landing(res).searchParams.get('next')).toBeNull();
      }
      const flow = await startLogin(app, '/reports?tab=year');
      const res = await callback(app, flow, provider.authorize(flow.location, sub('member')));
      expect(landing(res).searchParams.get('next')).toBe('/reports?tab=year');
    });
  });

  describe('the account behind the identity', () => {
    it('still asks for the account’s own second factor', async () => {
      const auth = (url: string, body: object) =>
        request(app.getHttpServer()).post(url).set('Authorization', `Bearer ${member.token}`).send(body);
      const setup = await auth('/auth/2fa/setup', { password: 'Test123!@#' }).expect(200);
      const enabled = await auth('/auth/2fa/enable', {
        code: generateSync({ secret: setup.body.secret }),
      }).expect(200);

      const flow = await startLogin(app);
      const back = await callback(app, flow, provider.authorize(flow.location, sub('member')));
      const ticket = responseCookie(back, 'oidc_ticket');
      const asked = await complete(app, ticket);
      expect(asked.body).toEqual({ twoFactorRequired: true });
      expect(responseCookie(asked, 'access_token')).toBeUndefined();
      const wrong = await complete(app, ticket, '000000');
      expect(wrong.status).toBe(401);
      expect(responseCookie(wrong, 'access_token')).toBeUndefined();
      // A recovery code: the TOTP step was just spent enabling 2FA.
      const good = await complete(app, ticket, enabled.body.recoveryCodes[0]);
      expect(good.status).toBe(200);
      expect(good.body.user.id).toBe(member.userId);
      // The ticket is spent with the session.
      expect((await complete(app, ticket)).status).toBe(401);
      await dataSource.query(
        `UPDATE users SET two_factor_enabled_at = NULL, two_factor_secret = NULL WHERE id = $1`,
        [member.userId],
      );
    });

    it('issues one session when the same sign-in is completed twice at once', async () => {
      const flow = await startLogin(app);
      const back = await callback(app, flow, provider.authorize(flow.location, sub('member')));
      const ticket = responseCookie(back, 'oidc_ticket');
      const results = await Promise.all([complete(app, ticket), complete(app, ticket)]);
      expect(results.map(res => res.status).sort()).toEqual([200, 401]);
    });

    it('links one identity once when two links race', async () => {
      const subject = sub('double-link');
      const flows = await Promise.all([startLink(app, other.token), startLink(app, other.token)]);
      const results = await Promise.all(
        flows.map(flow => callback(app, flow, provider.authorize(flow.location, subject))),
      );
      expect(results.map(res => landing(res).searchParams.get('oidc'))).toEqual(['linked', 'linked']);
      expect(await identityRows(subject)).toEqual([{ user_id: other.userId }]);
    });

    it('refuses a deactivated user', async () => {
      await dataSource.query('UPDATE users SET is_active = false WHERE id = $1', [member.userId]);
      try {
        const result = await signIn(app, provider, sub('member'));
        expect(errorOf(result.callback)).toBe('AUTH_ACCOUNT_INACTIVE');
        expect(result.completed).toBeNull();
      } finally {
        await dataSource.query('UPDATE users SET is_active = true WHERE id = $1', [member.userId]);
      }
    });

    it('keeps the last way in of an account without a password, and unlinks otherwise', async () => {
      const newcomerEmail = `${sub('newcomer')}@example.com`;
      const [newcomer] = await dataSource.query('SELECT id FROM users WHERE email = $1', [newcomerEmail]);
      const newcomerSignIn = await signIn(app, provider, sub('newcomer'));
      const newcomerAccount = { token: newcomerSignIn.token } as E2eAccount;
      const list = await as(newcomerAccount).get('/auth/oidc/identities').expect(200);
      expect(list.body).toMatchObject({ passwordSet: false, providerEnabled: true });
      const refused = await as(newcomerAccount).del(`/auth/oidc/identities/${list.body.identities[0].id}`);
      expect(refused.status).toBe(409);
      expect(refused.body.error?.code ?? refused.body.code).toBe('OIDC_LAST_SIGN_IN_METHOD');
      expect(await identityRows(sub('newcomer'))).toEqual([{ user_id: newcomer.id }]);

      const own = await as(member).get('/auth/oidc/identities').expect(200);
      expect(own.body.passwordSet).toBe(true);
      const after = await as(member).del(`/auth/oidc/identities/${own.body.identities[0].id}`).expect(200);
      expect(after.body.identities).toEqual([]);
      const events = (await oidcEvents(member.userId)).map((event: { meta: { oidcEvent: string } }) => event.meta.oidcEvent);
      expect(events).toContain('unlinked');
      // Unlinked: the provider account no longer opens it, though its e-mail is the member's.
      const again = await signIn(app, provider, sub('member'));
      expect(`${sub('member')}@example.com`).toBe(memberEmail);
      expect(errorOf(again.callback)).toBe('OIDC_ACCOUNT_EXISTS');
    });

    it('never hands out the client secret, a token or the provider’s own error text', async () => {
      const all = seenAnswers.join('\n');
      expect(all).not.toContain(provider.clientSecret);
      expect(all).not.toContain('mock-access');
      expect(all).not.toMatch(/eyJ[\w-]+\.eyJ/);
      expect(all).not.toContain('provider says no');
    });
  });
});
