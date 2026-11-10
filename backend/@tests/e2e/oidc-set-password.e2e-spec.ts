import { createHash } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import { ThrottlerStorage, ThrottlerStorageService } from '@nestjs/throttler';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { ACCESS_TOKEN_COOKIE } from '../../src/modules/auth/auth-cookies';
import { OidcStateStore } from '../../src/modules/auth/oidc/oidc-state.store';
import {
  OidcStepUpService,
  type StepUpRecord,
} from '../../src/modules/auth/oidc/oidc-step-up.service';
import {
  deleteUserByEmail,
  type E2eAccount,
  e2eTestingModule,
  registerAccount,
  responseCookie,
} from './helpers/e2e-app';
import { MockOidcProvider, type TokenShape } from './helpers/mock-oidc-provider';
import { APP_ORIGIN, callback, configureProvider, landing, signIn } from './helpers/oidc-flow';

/**
 * Setting a first password on an account made by single sign-on: a fresh
 * sign-in at the provider, with an identity linked to the very user, grants
 * one session a single-use step-up for five minutes.
 */
describe('Single sign-on: set a password (e2e)', () => {
  const stamp = Date.now();
  const sub = (name: string) => `oidc-setpw-${name}-${stamp}`;
  const adminEmail = `oidc-setpw-admin-${stamp}@example.com`;
  const createdEmails: string[] = [];
  const previousAppUrl = process.env.APP_URL;
  const NEW_PASSWORD = 'Fresh-Passw0rd!';
  let app: INestApplication;
  let dataSource: DataSource;
  let provider: MockOidcProvider;
  let admin: E2eAccount;

  const codeOf = (res: request.Response) => res.body.error?.code ?? res.body.code;
  const sessionOf = (token: string): string =>
    JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString()).sessionId;
  const asUser = (token: string) => ({
    get: (url: string) =>
      request(app.getHttpServer()).get(url).set('Authorization', `Bearer ${token}`),
    post: (url: string, body: object = {}) =>
      request(app.getHttpServer()).post(url).set('Authorization', `Bearer ${token}`).send(body),
    patch: (url: string, body: object) =>
      request(app.getHttpServer()).patch(url).set('Authorization', `Bearer ${token}`).send(body),
  });
  const oidcEvents = (userId: string) =>
    dataSource
      .query(
        `SELECT meta FROM audit_events WHERE entity_id = $1 AND meta ? 'oidcEvent' ORDER BY created_at`,
        [userId],
      )
      .then((rows: { meta: Record<string, unknown> }[]) => rows.map(row => row.meta));
  const passwordSetOf = async (userId: string): Promise<boolean> => {
    const [row] = await dataSource.query('SELECT password_set FROM users WHERE id = $1', [userId]);
    return row.password_set;
  };

  /** An account made by a first sign-in through the provider; a new session per call. */
  const ssoAccount = async (name: string) => {
    const result = await signIn(app, provider, sub(name));
    if (!result.token) throw new Error(`sign-in failed: ${JSON.stringify(result.callback.headers)}`);
    const email = `${sub(name)}@example.com`;
    if (!createdEmails.includes(email)) createdEmails.push(email);
    return { token: result.token, userId: result.completed?.body.user.id as string, email };
  };
  const startReauth = async (token: string) => {
    const res = await asUser(token).post('/auth/oidc/reauth');
    return { res, location: res.body.url as string, binding: responseCookie(res, 'oidc_flow') };
  };
  /** Start, the provider (as `subject`), the callback: the redirect and the step-up cookie. */
  const reauth = async (token: string, subject: string, shape: TokenShape = {}) => {
    const flow = await startReauth(token);
    if (flow.res.status !== 200 || !flow.binding) {
      throw new Error(`reauth failed: ${flow.res.status} ${JSON.stringify(flow.res.body)}`);
    }
    const flowRef = { location: flow.location, binding: flow.binding };
    const back = await callback(app, flowRef, provider.authorize(flow.location, subject, shape));
    return { back, location: flow.location, stepUp: responseCookie(back, 'oidc_step_up') };
  };
  const setPassword = (token: string, stepUp: string | undefined, newPassword = NEW_PASSWORD) => {
    const req = request(app.getHttpServer())
      .post('/auth/password/set')
      .set('Authorization', `Bearer ${token}`);
    return (stepUp ? req.set('Cookie', `oidc_step_up=${stepUp}`) : req).send({ newPassword });
  };

  beforeAll(async () => {
    process.env.APP_URL = APP_ORIGIN;
    provider = await new MockOidcProvider().start();
    const moduleFixture: TestingModule = await e2eTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    await app.init();
    dataSource = moduleFixture.get(DataSource);
    admin = await registerAccount(app, adminEmail, 'Admin One');
    await dataSource.query('UPDATE users SET role = $1 WHERE id = $2', ['admin', admin.userId]);
    const saved = await configureProvider(app, admin.token, provider, { allowSignup: true });
    if (saved.status !== 200) throw new Error(`${saved.status} ${JSON.stringify(saved.body)}`);
  });

  afterAll(async () => {
    await dataSource.query(`DELETE FROM instance_settings WHERE key = 'oidc'`);
    for (const email of [adminEmail, ...createdEmails]) await deleteUserByEmail(dataSource, email);
    await app.close();
    await provider.close();
    process.env.APP_URL = previousAppUrl;
  });

  it('walks the whole way: provider sign-in, the password, then 2FA and e-mail change', async () => {
    const other = await ssoAccount('walk');
    const account = await ssoAccount('walk');
    expect((await asUser(account.token).get('/auth/me').expect(200)).body.passwordSet).toBe(false);
    // An answer built from the users service's own select says the same.
    const prefs = await asUser(account.token).patch('/users/me/preferences', { locale: 'en' });
    expect(prefs.body.user.passwordSet).toBe(false);

    const { back, location, stepUp } = await reauth(account.token, sub('walk'));
    const asked = new URL(location).searchParams;
    expect(asked.get('prompt')).toBe('login');
    expect(asked.get('max_age')).toBe('0');
    const page = landing(back);
    expect(`${page.origin}${page.pathname}`).toBe(`${APP_ORIGIN}/settings/profile`);
    expect(page.searchParams.get('section')).toBe('password');
    expect(page.searchParams.get('reauth')).toBe('ok');
    expect(stepUp).toEqual(expect.any(String));
    const cookie = ([] as string[]).concat(back.headers['set-cookie']).find(c => c.startsWith('oidc_step_up='));
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/Max-Age=300/);
    expect(JSON.stringify({ body: back.body, location: back.headers.location })).not.toContain(
      stepUp as string,
    );

    const set = await setPassword(account.token, stepUp);
    expect(set.status).toBe(200);
    expect(set.body.user).toMatchObject({ id: account.userId, passwordSet: true });
    expect(JSON.stringify(set.body)).not.toContain(NEW_PASSWORD);
    expect(await passwordSetOf(account.userId)).toBe(true);
    const fresh = responseCookie(set, ACCESS_TOKEN_COOKIE) as string;
    expect(fresh).toEqual(expect.any(String));

    // Every other session is out, this device carries on with a new one.
    await asUser(other.token).get('/auth/me').expect(401);
    await asUser(account.token).get('/auth/me').expect(401);
    expect((await asUser(fresh).get('/auth/me').expect(200)).body.passwordSet).toBe(true);
    // The old sessions are revoked rows too, not only dead tokens.
    const sessionRows: { id: string; revoked_at: Date | null }[] = await dataSource.query(
      'SELECT id, revoked_at FROM auth_sessions WHERE user_id = $1',
      [account.userId],
    );
    const live = sessionRows.filter(row => row.revoked_at === null).map(row => row.id);
    expect(live).toEqual([sessionOf(fresh)]);
    expect(sessionRows.map(row => row.id)).toEqual(
      expect.arrayContaining([sessionOf(other.token), sessionOf(account.token)]),
    );

    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: account.email, password: NEW_PASSWORD });
    expect(login.status).toBe(200);
    await asUser(fresh).post('/auth/2fa/setup', { password: NEW_PASSWORD }).expect(200);
    const nextEmail = `${sub('walk-moved')}@example.com`;
    createdEmails.push(nextEmail);
    await asUser(fresh)
      .patch('/users/me/email', { email: nextEmail, currentPassword: NEW_PASSWORD })
      .expect(200);

    const events = await oidcEvents(account.userId);
    expect(events).toContainEqual(expect.objectContaining({ oidcEvent: 'reauthenticated' }));
    const [audit] = await dataSource.query(
      `SELECT meta FROM audit_events WHERE entity_id = $1 AND meta->>'password' = 'set'`,
      [account.userId],
    );
    expect(audit.meta).toMatchObject({ sessions: 'all-revoked', provider: provider.issuer });
    expect(JSON.stringify(events)).not.toContain(stepUp as string);
  });

  describe('the provider must prove a fresh sign-in (auth_time)', () => {
    const now = () => Math.floor(Date.now() / 1000);
    it.each([
      ['missing', { omit: ['auth_time'] }],
      ['older than five minutes', { claims: { auth_time: now() - 301 } }],
      ['far in the future', { claims: { auth_time: now() + 600 } }],
      ['not a number', { claims: { auth_time: String(now()) } }],
    ] as [string, TokenShape][])('refuses an auth_time %s', async (_label, shape) => {
      const account = await ssoAccount('stale');
      const { back, stepUp } = await reauth(account.token, sub('stale'), shape);
      expect(stepUp).toBeUndefined();
      expect(landing(back).searchParams.get('reauthError')).toBe('OIDC_REAUTH_NOT_FRESH');
      expect((await oidcEvents(account.userId)).at(-1)).toMatchObject({
        oidcEvent: 'refused',
        reason: 'OIDC_REAUTH_NOT_FRESH',
      });
      expect(await passwordSetOf(account.userId)).toBe(false);
    });

    it('takes one made just now', async () => {
      const account = await ssoAccount('fresh');
      const { stepUp } = await reauth(account.token, sub('fresh'), {
        claims: { auth_time: now() - 30 },
      });
      expect(stepUp).toEqual(expect.any(String));
    });

    it('refuses a recent sign-in made before the re-authentication began', async () => {
      // A provider that ignores prompt=login and max_age=0 answers the
      // remembered sign-in: under five minutes old, yet older than the flow.
      const account = await ssoAccount('remembered');
      const { back, stepUp } = await reauth(account.token, sub('remembered'), {
        claims: { auth_time: now() - 200 },
      });
      expect(stepUp).toBeUndefined();
      expect(landing(back).searchParams.get('reauthError')).toBe('OIDC_REAUTH_NOT_FRESH');
      expect(await passwordSetOf(account.userId)).toBe(false);
    });
  });

  it("refuses another user's provider account, and one linked to nobody", async () => {
    const victim = await ssoAccount('victim');
    const intruder = await ssoAccount('intruder');
    for (const subject of [sub('victim'), sub('unlinked')]) {
      const { back, stepUp } = await reauth(intruder.token, subject);
      expect(stepUp).toBeUndefined();
      expect(landing(back).searchParams.get('reauthError')).toBe('OIDC_REAUTH_WRONG_ACCOUNT');
      expect((await oidcEvents(intruder.userId)).at(-1)).toMatchObject({
        oidcEvent: 'refused',
        reason: 'OIDC_REAUTH_WRONG_ACCOUNT',
      });
    }
    expect(await passwordSetOf(intruder.userId)).toBe(false);
    expect(await passwordSetOf(victim.userId)).toBe(false);
  });

  it('refuses without a step-up, with a forged one, and with one already spent', async () => {
    const account = await ssoAccount('replay');
    const none = await setPassword(account.token, undefined);
    expect(none.status).toBe(403);
    expect(codeOf(none)).toBe('AUTH_STEP_UP_REQUIRED');
    const forged = await setPassword(account.token, 'not-a-step-up');
    expect(codeOf(forged)).toBe('AUTH_STEP_UP_REQUIRED');

    const { stepUp } = await reauth(account.token, sub('replay'));
    const store = app.get(OidcStateStore);
    const service = app.get(OidcStepUpService);
    const sessionId = sessionOf(account.token);
    expect(await service.consume(stepUp, account.userId, sessionId)).toMatchObject({
      userId: account.userId,
      sessionId,
    });
    // Spent: the same cookie finds nothing, neither through the service nor over HTTP.
    expect(await store.peek('step-up', stepUp as string)).toBeNull();
    expect(await service.consume(stepUp, account.userId, sessionId)).toBeNull();
    const replay = await setPassword(account.token, stepUp);
    expect(replay.status).toBe(403);
    expect(codeOf(replay)).toBe('AUTH_STEP_UP_REQUIRED');
    expect(await passwordSetOf(account.userId)).toBe(false);
    expect((await oidcEvents(account.userId)).at(-1)).toMatchObject({
      oidcEvent: 'refused',
      reason: 'AUTH_STEP_UP_REQUIRED',
    });
  });

  it('lets two requests with one step-up set the password once', async () => {
    const account = await ssoAccount('double');
    const { stepUp } = await reauth(account.token, sub('double'));
    const answers = await Promise.all([
      setPassword(account.token, stepUp),
      setPassword(account.token, stepUp, 'Another-Passw0rd!'),
    ]);
    expect(answers.map(res => res.status).sort()).toEqual([200, 403]);
    const logins = await Promise.all(
      [NEW_PASSWORD, 'Another-Passw0rd!'].map(password =>
        request(app.getHttpServer()).post('/auth/login').send({ email: account.email, password }),
      ),
    );
    expect(logins.map(res => res.status).sort()).toEqual([200, 401]);
    expect(logins[answers.findIndex(res => res.status === 200)].status).toBe(200);
  });

  it('lets two sessions with a step-up each set the password once', async () => {
    const first = await ssoAccount('two-sessions');
    const second = await ssoAccount('two-sessions');
    const a = await reauth(first.token, sub('two-sessions'));
    const b = await reauth(second.token, sub('two-sessions'));
    const answers = await Promise.all([
      setPassword(first.token, a.stepUp),
      setPassword(second.token, b.stepUp, 'Another-Passw0rd!'),
    ]);
    expect(answers.map(res => res.status).sort()).toEqual([200, 409]);
    expect(codeOf(answers.find(res => res.status === 409) as request.Response)).toBe(
      'AUTH_PASSWORD_ALREADY_SET',
    );
    const [set] = await dataSource.query(
      `SELECT count(*)::int AS n FROM audit_events WHERE entity_id = $1 AND meta->>'password' = 'set'`,
      [first.userId],
    );
    expect(set.n).toBe(1);
  });

  it('refuses a step-up from another session of the same user, and burns it', async () => {
    const first = await ssoAccount('sessions');
    const second = await ssoAccount('sessions');
    expect(sessionOf(first.token)).not.toBe(sessionOf(second.token));
    const { stepUp } = await reauth(first.token, sub('sessions'));
    const elsewhere = await setPassword(second.token, stepUp);
    expect(elsewhere.status).toBe(403);
    expect(codeOf(elsewhere)).toBe('AUTH_STEP_UP_REQUIRED');
    // The refused attempt spent it: the session it was granted to must start again.
    expect(codeOf(await setPassword(first.token, stepUp))).toBe('AUTH_STEP_UP_REQUIRED');
    expect(await passwordSetOf(first.userId)).toBe(false);
    const again = await reauth(first.token, sub('sessions'));
    expect((await setPassword(first.token, again.stepUp)).status).toBe(200);
  });

  it("refuses another user's step-up", async () => {
    const owner = await ssoAccount('owner');
    const thief = await ssoAccount('thief');
    const { stepUp } = await reauth(owner.token, sub('owner'));
    const stolen = await setPassword(thief.token, stepUp);
    expect(stolen.status).toBe(403);
    expect(codeOf(stolen)).toBe('AUTH_STEP_UP_REQUIRED');
    expect(await passwordSetOf(thief.userId)).toBe(false);
    expect(await passwordSetOf(owner.userId)).toBe(false);
  });

  it('refuses an expired step-up, and Redis keeps it five minutes at most', async () => {
    const account = await ssoAccount('expired');
    const { stepUp } = await reauth(account.token, sub('expired'));
    const store = app.get(OidcStateStore);
    const key = `oidc:step-up:${createHash('sha256').update(stepUp as string).digest('hex')}`;
    const ttl = await (store as unknown as { redis: { ttl(k: string): Promise<number> } }).redis.ttl(
      key,
    );
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(300);
    const record = (await store.peek<StepUpRecord>('step-up', stepUp as string)) as StepUpRecord;
    await store.put('step-up', stepUp as string, { ...record, expiresAt: Date.now() - 1 }, 60);
    const late = await setPassword(account.token, stepUp);
    expect(late.status).toBe(403);
    expect(codeOf(late)).toBe('AUTH_STEP_UP_REQUIRED');
    expect(await passwordSetOf(account.userId)).toBe(false);
  });

  it('refuses an account that already has a password, even with a valid step-up', async () => {
    const start = await asUser(admin.token).post('/auth/oidc/reauth');
    expect(start.status).toBe(409);
    expect(codeOf(start)).toBe('AUTH_PASSWORD_ALREADY_SET');
    expect(responseCookie(start, 'oidc_flow')).toBeUndefined();

    const secret = `planted-${stamp}`;
    const planted: StepUpRecord = {
      userId: admin.userId,
      sessionId: sessionOf(admin.token),
      identityId: '00000000-0000-0000-0000-000000000000',
      issuer: provider.issuer,
      expiresAt: Date.now() + 60_000,
    };
    await app.get(OidcStateStore).put('step-up', secret, planted, 60);
    const set = await setPassword(admin.token, secret);
    expect(set.status).toBe(409);
    expect(codeOf(set)).toBe('AUTH_PASSWORD_ALREADY_SET');
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: adminEmail, password: 'Test123!@#' });
    expect(login.status).toBe(200);
  });

  it('refuses a step-up granted before the account got a password another way', async () => {
    const account = await ssoAccount('raced');
    const { stepUp } = await reauth(account.token, sub('raced'));
    // A reset finished in the meantime.
    await dataSource.query('UPDATE users SET password_set = true WHERE id = $1', [account.userId]);
    const set = await setPassword(account.token, stepUp);
    expect(codeOf(set)).toBe('AUTH_PASSWORD_ALREADY_SET');
  });

  it('holds the new password to the password-change rule', async () => {
    const account = await ssoAccount('short');
    const { stepUp } = await reauth(account.token, sub('short'));
    const short = await setPassword(account.token, stepUp, 'short');
    expect(short.status).toBe(400);
    // A refused body does not spend the step-up: the person may fix a typo.
    expect((await setPassword(account.token, stepUp)).status).toBe(200);
  });

  describe('rate limit', () => {
    let limitedApp: INestApplication;

    // Its own app with a real in-memory store: the shared helper counts nothing.
    beforeAll(async () => {
      const moduleFixture = await e2eTestingModule({ imports: [AppModule] })
        .overrideProvider(ThrottlerStorage)
        .useValue(new ThrottlerStorageService())
        .compile();
      limitedApp = moduleFixture.createNestApplication();
      limitedApp.use(cookieParser());
      await limitedApp.init();
    });

    afterAll(async () => {
      await limitedApp.close();
    });

    it('allows five tries a minute, like a password change', async () => {
      const account = await ssoAccount('limited');
      const statuses: number[] = [];
      for (let i = 0; i < 7; i++) {
        const res = await request(limitedApp.getHttpServer())
          .post('/auth/password/set')
          .set('Authorization', `Bearer ${account.token}`)
          .send({ newPassword: NEW_PASSWORD });
        statuses.push(res.status);
      }
      expect(statuses.slice(0, 5)).toEqual([403, 403, 403, 403, 403]);
      expect(statuses.slice(5)).toEqual([429, 429]);
    });
  });
});
