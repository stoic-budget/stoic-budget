import { type INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerStorage, ThrottlerStorageService } from '@nestjs/throttler';
import cookieParser from 'cookie-parser';
import Redis from 'ioredis';
import { generateSync } from 'otplib';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import {
  accessTokenOf,
  deleteUserByEmail,
  type E2eAccount,
  e2eTestingModule,
  registerAccount,
} from './helpers/e2e-app';
import { FLAG_UP, SoftAuthenticator } from './helpers/soft-authenticator';

const PASSWORD = 'Test123!@#';
const RP_ID = 'budget.example.co.il';
const ORIGIN = `https://${RP_ID}`;

const validationPipe = () =>
  new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true });

/**
 * Passkeys end to end, against a software authenticator: registration, sign-in
 * without an e-mail, the second factor, and every check that keeps a signed
 * answer from being reused or forged.
 */
describe('Passkeys (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  const previousEnv = { APP_URL: process.env.APP_URL, FRONTEND_URL: process.env.FRONTEND_URL };
  const stamp = Date.now();
  const emails: string[] = [];
  const server = () => app.getHttpServer();

  const register = async (who: string) => {
    const email = `passkeys-${who}-${stamp}@example.com`;
    emails.push(email);
    return registerAccount(app, email, `Member ${who}`);
  };
  const as = (account: E2eAccount, method: 'get' | 'post' | 'patch' | 'delete', url: string) =>
    request(server())[method](url).set('Authorization', `Bearer ${account.token}`);

  /** Runs the whole registration with `authenticator` and answers the new passkey. */
  const addPasskey = async (account: E2eAccount, authenticator: SoftAuthenticator, name = 'Laptop') => {
    const options = await as(account, 'post', '/auth/passkeys/registration-options')
      .send({ password: PASSWORD })
      .expect(200);
    const created = await as(account, 'post', '/auth/passkeys')
      .send({ name, credential: authenticator.attest(options.body.challenge) })
      .expect(201);
    return created.body as { id: string; name: string };
  };

  /** A browser (cookie jar) that asked for a sign-in challenge. */
  const startSignIn = async () => {
    const browser = request.agent(server());
    const options = await browser.post('/auth/passkey-login/options').expect(200);
    return { browser, challenge: options.body.challenge as string, options: options.body };
  };

  const auditMeta = async (userId: string): Promise<Array<Record<string, unknown>>> => {
    const rows: Array<{ meta: Record<string, unknown> }> = await dataSource.query(
      `SELECT meta FROM audit_events WHERE entity_id = $1 AND meta ? 'passkey' ORDER BY created_at`,
      [userId],
    );
    return rows.map(({ meta }) => ({ passkey: meta.passkey, passkeyId: meta.passkeyId }));
  };

  beforeAll(async () => {
    process.env.APP_URL = `${ORIGIN}/`;
    delete process.env.FRONTEND_URL;
    const moduleFixture = await e2eTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    // As main.ts does: the sign-in reads its flow cookie.
    app.use(cookieParser());
    app.useGlobalPipes(validationPipe());
    await app.init();
    dataSource = moduleFixture.get(DataSource);
  });

  afterAll(async () => {
    for (const email of emails) await deleteUserByEmail(dataSource, email);
    await app.close();
    // Assigning undefined would store the string "undefined".
    for (const [key, value] of Object.entries(previousEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  describe('registration', () => {
    it('asks for the password again before issuing a challenge', async () => {
      const account = await register('reauth');
      await as(account, 'post', '/auth/passkeys/registration-options')
        .send({ password: 'wrong-password' })
        .expect(403);
    });

    it('adds a passkey, lists it and audits the change', async () => {
      const account = await register('adds');
      const authenticator = new SoftAuthenticator(RP_ID, ORIGIN);
      const options = await as(account, 'post', '/auth/passkeys/registration-options')
        .send({ password: PASSWORD })
        .expect(200);
      expect(options.body.rp).toEqual({ id: RP_ID, name: expect.any(String) });
      expect(options.body.authenticatorSelection.residentKey).toBe('required');
      // Kept server-side for five minutes at most.
      const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
      const ttl = await redis.pttl(`passkey:challenge:register:${account.userId}`);
      redis.disconnect();
      expect(ttl).toBeGreaterThan(0);
      expect(ttl).toBeLessThanOrEqual(5 * 60 * 1000);

      const created = await as(account, 'post', '/auth/passkeys')
        .send({ name: '  Work laptop  ', credential: authenticator.attest(options.body.challenge) })
        .expect(201);
      expect(created.body).toMatchObject({ name: 'Work laptop', lastUsedAt: null });

      const list = await as(account, 'get', '/auth/passkeys').expect(200);
      expect(list.body).toEqual([created.body]);
      expect(JSON.stringify(list.body)).not.toContain(authenticator.credentialId);
      expect(await auditMeta(account.userId)).toEqual([
        { passkey: 'added', passkeyId: created.body.id },
      ]);

      // The same authenticator twice is one passkey, not two.
      const again = await as(account, 'post', '/auth/passkeys/registration-options')
        .send({ password: PASSWORD })
        .expect(200);
      expect(again.body.excludeCredentials).toEqual([
        expect.objectContaining({ id: authenticator.credentialId }),
      ]);
      await as(account, 'post', '/auth/passkeys')
        .send({ name: 'Again', credential: authenticator.attest(again.body.challenge) })
        .expect(409);
    });

    it('spends the challenge once: two answers at the same time add one passkey', async () => {
      const account = await register('race');
      const options = await as(account, 'post', '/auth/passkeys/registration-options')
        .send({ password: PASSWORD })
        .expect(200);
      const statuses = await Promise.all(
        [new SoftAuthenticator(RP_ID, ORIGIN), new SoftAuthenticator(RP_ID, ORIGIN)].map(
          async authenticator =>
            (
              await as(account, 'post', '/auth/passkeys').send({
                name: 'Twin',
                credential: authenticator.attest(options.body.challenge),
              })
            ).status,
        ),
      );
      expect(statuses.sort()).toEqual([201, 400]);
      expect((await as(account, 'get', '/auth/passkeys').expect(200)).body).toHaveLength(1);
    });

    it('refuses an answer for another origin or RP ID', async () => {
      const account = await register('reg-origin');
      for (const overrides of [{ origin: 'https://evil.example.com' }, { rpId: 'evil.example.com' }]) {
        const options = await as(account, 'post', '/auth/passkeys/registration-options')
          .send({ password: PASSWORD })
          .expect(200);
        await as(account, 'post', '/auth/passkeys')
          .send({
            name: 'Forged',
            credential: new SoftAuthenticator(RP_ID, ORIGIN).attest(options.body.challenge, overrides),
          })
          .expect(400);
      }
      expect((await as(account, 'get', '/auth/passkeys').expect(200)).body).toEqual([]);
    });

    it('refuses a challenge issued to another user', async () => {
      const owner = await register('reg-owner');
      const other = await register('reg-other');
      const options = await as(owner, 'post', '/auth/passkeys/registration-options')
        .send({ password: PASSWORD })
        .expect(200);
      await as(other, 'post', '/auth/passkeys')
        .send({
          name: 'Stolen',
          credential: new SoftAuthenticator(RP_ID, ORIGIN).attest(options.body.challenge),
        })
        .expect(400);
    });
  });

  describe('sign-in without an e-mail', () => {
    it('signs in with user verification and records the use', async () => {
      const account = await register('signin');
      const authenticator = new SoftAuthenticator(RP_ID, ORIGIN);
      await addPasskey(account, authenticator);

      const { browser, challenge, options } = await startSignIn();
      expect(options).toMatchObject({ rpId: RP_ID, userVerification: 'required', allowCredentials: [] });
      const res = await browser
        .post('/auth/passkey-login')
        .send({ credential: authenticator.assert(challenge, {}, Buffer.from(account.userId).toString('base64url')) })
        .expect(200);
      expect(res.body.user.id).toBe(account.userId);
      accessTokenOf(res);
      const [passkey] = (await as(account, 'get', '/auth/passkeys').expect(200)).body;
      expect(passkey.lastUsedAt).not.toBeNull();
    });

    it('refuses a replayed answer', async () => {
      const account = await register('replay');
      // No counter, so only the spent challenge can stop the replay.
      const authenticator = new SoftAuthenticator(RP_ID, ORIGIN, { counter: 0 });
      await addPasskey(account, authenticator);
      const options = await request(server()).post('/auth/passkey-login/options').expect(200);
      // The flow cookie kept by hand: the browser drops it after the sign-in, an attacker would not.
      const flowCookie = ([] as string[])
        .concat(options.headers['set-cookie'] ?? [])
        .map(cookie => cookie.split(';')[0])
        .find(pair => pair.startsWith('passkey_flow=')) as string;
      const credential = authenticator.assert(options.body.challenge);
      const send = () =>
        request(server()).post('/auth/passkey-login').set('Cookie', flowCookie).send({ credential });
      await send().expect(200);
      const replay = await send().expect(401);
      expect(replay.body.error.code).toBe('AUTH_PASSKEY_INVALID');
    });

    it('refuses an answer signed for another origin or RP ID', async () => {
      const account = await register('origin');
      const authenticator = new SoftAuthenticator(RP_ID, ORIGIN);
      await addPasskey(account, authenticator);
      for (const overrides of [
        { origin: 'https://evil.example.com' },
        { origin: `http://${RP_ID}` },
        { rpId: 'evil.example.com' },
      ]) {
        const { browser, challenge } = await startSignIn();
        await browser
          .post('/auth/passkey-login')
          .send({ credential: authenticator.assert(challenge, overrides) })
          .expect(401);
      }
    });

    it('ignores the Host and Origin headers the request carries', async () => {
      const account = await register('host-header');
      // Registered against the configured RP, then answering as the attacker's site.
      const genuine = new SoftAuthenticator(RP_ID, ORIGIN);
      await addPasskey(account, genuine);
      const browser = request.agent(server());
      const options = await browser
        .post('/auth/passkey-login/options')
        .set('Host', 'evil.example.com')
        .set('Origin', 'https://evil.example.com')
        .expect(200);
      expect(options.body.rpId).toBe(RP_ID);
      await browser
        .post('/auth/passkey-login')
        .set('Origin', 'https://evil.example.com')
        .send({
          credential: genuine.assert(options.body.challenge, {
            origin: 'https://evil.example.com',
            rpId: 'evil.example.com',
          }),
        })
        .expect(401);
    });

    it('requires user verification', async () => {
      const account = await register('uv');
      const authenticator = new SoftAuthenticator(RP_ID, ORIGIN);
      await addPasskey(account, authenticator);
      const { browser, challenge } = await startSignIn();
      await browser
        .post('/auth/passkey-login')
        .send({ credential: authenticator.assert(challenge, { flags: FLAG_UP }) })
        .expect(401);
    });

    it('binds the challenge to the browser that asked for it', async () => {
      const account = await register('browser');
      const authenticator = new SoftAuthenticator(RP_ID, ORIGIN);
      await addPasskey(account, authenticator);
      const first = await startSignIn();
      const second = await startSignIn();
      // The second browser answers the first one's challenge.
      await second.browser
        .post('/auth/passkey-login')
        .send({ credential: authenticator.assert(first.challenge) })
        .expect(401);
      // No cookie at all.
      await request(server())
        .post('/auth/passkey-login')
        .send({ credential: authenticator.assert(first.challenge) })
        .expect(401);
    });

    it('refuses a challenge issued for another flow', async () => {
      const account = await register('flow');
      const authenticator = new SoftAuthenticator(RP_ID, ORIGIN);
      await addPasskey(account, authenticator);
      const registration = await as(account, 'post', '/auth/passkeys/registration-options')
        .send({ password: PASSWORD })
        .expect(200);
      const { browser } = await startSignIn();
      await browser
        .post('/auth/passkey-login')
        .send({ credential: authenticator.assert(registration.body.challenge) })
        .expect(401);
    });

    it('answers an unknown passkey exactly like a bad signature', async () => {
      const { browser, challenge } = await startSignIn();
      const stranger = new SoftAuthenticator(RP_ID, ORIGIN);
      const res = await browser
        .post('/auth/passkey-login')
        .send({ credential: stranger.assert(challenge) })
        .expect(401);
      expect(res.body.error.code).toBe('AUTH_PASSKEY_INVALID');
    });

    it('refuses and audits a sign counter that went backwards', async () => {
      const account = await register('counter');
      const authenticator = new SoftAuthenticator(RP_ID, ORIGIN, { counter: 5 });
      const passkey = await addPasskey(account, authenticator);
      let attempt = await startSignIn();
      await attempt.browser
        .post('/auth/passkey-login')
        .send({ credential: authenticator.assert(attempt.challenge, { counter: 5 }) })
        .expect(200);
      for (const counter of [3, 5]) {
        attempt = await startSignIn();
        const res = await attempt.browser
          .post('/auth/passkey-login')
          .send({ credential: authenticator.assert(attempt.challenge, { counter }) })
          .expect(401);
        expect(res.body.error.code).toBe('AUTH_PASSKEY_COUNTER_REGRESSION');
      }
      expect(await auditMeta(account.userId)).toEqual([
        { passkey: 'added', passkeyId: passkey.id },
        { passkey: 'counter_regression', passkeyId: passkey.id },
        { passkey: 'counter_regression', passkeyId: passkey.id },
      ]);
      attempt = await startSignIn();
      await attempt.browser
        .post('/auth/passkey-login')
        .send({ credential: authenticator.assert(attempt.challenge, { counter: 6 }) })
        .expect(200);
    });

    it('audits passkey events of a user whose home workspace is gone in a workspace they belong to', async () => {
      const account = await register('homeless');
      const host = await register('homeless-host');
      const authenticator = new SoftAuthenticator(RP_ID, ORIGIN, { counter: 5 });
      const passkey = await addPasskey(account, authenticator);
      await dataSource.query(
        `INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ($1, $2, 'member')`,
        [host.workspaceId, account.userId],
      );
      await as(account, 'delete', `/workspaces/${account.workspaceId}`)
        .set('x-workspace-id', account.workspaceId)
        .expect(200);
      const [{ workspace_id: home }] = await dataSource.query(
        'SELECT workspace_id FROM users WHERE id = $1',
        [account.userId],
      );
      expect(home).toBeNull();

      let attempt = await startSignIn();
      await attempt.browser
        .post('/auth/passkey-login')
        .send({ credential: authenticator.assert(attempt.challenge, { counter: 9 }) })
        .expect(200);
      attempt = await startSignIn();
      await attempt.browser
        .post('/auth/passkey-login')
        .send({ credential: authenticator.assert(attempt.challenge, { counter: 2 }) })
        .expect(401);
      await as(account, 'delete', `/auth/passkeys/${passkey.id}`).send({ password: PASSWORD }).expect(200);

      // 'added' was filed in the home workspace, before it was deleted.
      const rows: Array<{ passkey: string }> = await dataSource.query(
        `SELECT meta->>'passkey' AS passkey FROM audit_events
          WHERE entity_id = $1 AND workspace_id = $2 AND meta ? 'passkey' ORDER BY created_at`,
        [account.userId, host.workspaceId],
      );
      expect(rows.map(row => row.passkey)).toEqual(['counter_regression', 'removed']);
    });

    it('accepts an authenticator that keeps no counter', async () => {
      const account = await register('nocounter');
      const authenticator = new SoftAuthenticator(RP_ID, ORIGIN, { counter: 0 });
      await addPasskey(account, authenticator);
      for (let i = 0; i < 2; i++) {
        const { browser, challenge } = await startSignIn();
        await browser
          .post('/auth/passkey-login')
          .send({ credential: authenticator.assert(challenge) })
          .expect(200);
      }
    });

    it('refuses a deactivated account', async () => {
      const account = await register('inactive');
      const authenticator = new SoftAuthenticator(RP_ID, ORIGIN);
      await addPasskey(account, authenticator);
      await dataSource.query('UPDATE users SET is_active = false WHERE id = $1', [account.userId]);
      const { browser, challenge } = await startSignIn();
      const res = await browser
        .post('/auth/passkey-login')
        .send({ credential: authenticator.assert(challenge) })
        .expect(401);
      expect(res.body.error.code).toBe('AUTH_ACCOUNT_INACTIVE');
    });

    it('drops the passkeys of a deleted account', async () => {
      const account = await register('deleted');
      const authenticator = new SoftAuthenticator(RP_ID, ORIGIN);
      await addPasskey(account, authenticator);
      await as(account, 'delete', `/workspaces/${account.workspaceId}`)
        .set('x-workspace-id', account.workspaceId)
        .expect(200);
      await as(account, 'delete', '/users/me').send({ currentPassword: PASSWORD }).expect(200);
      const [{ n }] = await dataSource.query(
        'SELECT count(*)::int AS n FROM passkey_credentials WHERE user_id = $1',
        [account.userId],
      );
      expect(n).toBe(0);
      const { browser, challenge } = await startSignIn();
      await browser
        .post('/auth/passkey-login')
        .send({ credential: authenticator.assert(challenge) })
        .expect(401);
    });

    it('refuses a user handle that is not the owner of the passkey', async () => {
      const account = await register('handle');
      const other = await register('handle-other');
      const authenticator = new SoftAuthenticator(RP_ID, ORIGIN);
      await addPasskey(account, authenticator);
      const { browser, challenge } = await startSignIn();
      await browser
        .post('/auth/passkey-login')
        .send({
          credential: authenticator.assert(challenge, {}, Buffer.from(other.userId).toString('base64url')),
        })
        .expect(401);
    });
  });

  describe('second factor', () => {
    const enableTotp = async (account: E2eAccount) => {
      const setup = await as(account, 'post', '/auth/2fa/setup').send({ password: PASSWORD }).expect(200);
      await as(account, 'post', '/auth/2fa/enable')
        .send({ code: generateSync({ secret: setup.body.secret }) })
        .expect(200);
    };
    type Browser = ReturnType<typeof request.agent>;
    /** A password login from `browser` (a cookie jar, like the tab the user typed in). */
    const login = (browser: Browser, account: E2eAccount, extra: object = {}) =>
      browser.post('/auth/login').send({ email: account.email, password: PASSWORD, ...extra });
    const newBrowser = (): Browser => request.agent(server());
    const flowCookieOf = (res: request.Response): string =>
      ([] as string[])
        .concat(res.headers['set-cookie'] ?? [])
        .map(cookie => cookie.split(';')[0])
        .find(pair => pair.startsWith('passkey_2fa=')) as string;

    it('offers the passkey after the password and accepts it instead of a code', async () => {
      const account = await register('second');
      const authenticator = new SoftAuthenticator(RP_ID, ORIGIN);
      await addPasskey(account, authenticator);
      await enableTotp(account);

      const browser = newBrowser();
      const first = await login(browser, account).expect(200);
      expect(first.body).toMatchObject({
        twoFactorRequired: true,
        passkeyOptions: {
          rpId: RP_ID,
          userVerification: 'preferred',
          allowCredentials: [expect.objectContaining({ id: authenticator.credentialId })],
        },
      });
      // Without user verification is fine for a second factor: the password was the first.
      const res = await login(browser, account, {
        twoFactorPasskey: authenticator.assert(first.body.passkeyOptions.challenge, { flags: FLAG_UP }),
      }).expect(200);
      expect(res.body.user.id).toBe(account.userId);
      accessTokenOf(res);
    });

    it('offers no passkey to an account without one', async () => {
      const account = await register('totp-only');
      await enableTotp(account);
      const first = await login(newBrowser(), account).expect(200);
      expect(first.body).toEqual({ twoFactorRequired: true });
      expect(flowCookieOf(first)).toBeUndefined();
    });

    it('refuses another user’s passkey or challenge', async () => {
      const owner = await register('second-owner');
      const other = await register('second-other');
      const ownerKey = new SoftAuthenticator(RP_ID, ORIGIN);
      const otherKey = new SoftAuthenticator(RP_ID, ORIGIN);
      await addPasskey(owner, ownerKey);
      await addPasskey(other, otherKey);
      await enableTotp(owner);
      await enableTotp(other);

      // The other user's passkey answering the owner's challenge.
      const browser = newBrowser();
      const ownerChallenge = (await login(browser, owner).expect(200)).body.passkeyOptions.challenge;
      await login(browser, owner, { twoFactorPasskey: otherKey.assert(ownerChallenge) }).expect(401);
      // The owner's login cookie and challenge, answered by the other user's own passkey as the
      // other user's login: the browser is right, the user is not.
      const first = await request(server())
        .post('/auth/login')
        .send({ email: owner.email, password: PASSWORD })
        .expect(200);
      await request(server())
        .post('/auth/login')
        .set('Cookie', flowCookieOf(first))
        .send({
          email: other.email,
          password: PASSWORD,
          twoFactorPasskey: otherKey.assert(first.body.passkeyOptions.challenge),
        })
        .expect(401);
    });

    it('binds the challenge to the login attempt that typed the password', async () => {
      const account = await register('second-attempt');
      // No counter, so only the challenge binding decides.
      const authenticator = new SoftAuthenticator(RP_ID, ORIGIN, { counter: 0 });
      await addPasskey(account, authenticator);
      await enableTotp(account);

      // The user's tab, then a second login (another device, or someone holding the password).
      const victim = newBrowser();
      const victimChallenge = (await login(victim, account).expect(200)).body.passkeyOptions.challenge;
      const intruder = newBrowser();
      const intruderChallenge = (await login(intruder, account).expect(200)).body.passkeyOptions
        .challenge;
      expect(intruderChallenge).not.toBe(victimChallenge);

      // The user's answer from another browser, or with no cookie, is refused.
      await login(intruder, account, {
        twoFactorPasskey: authenticator.assert(victimChallenge),
      }).expect(401);
      await login(request(server()) as unknown as Browser, account, {
        twoFactorPasskey: authenticator.assert(victimChallenge),
      }).expect(401);
      // The second login did not knock the first one out.
      const res = await login(victim, account, {
        twoFactorPasskey: authenticator.assert(victimChallenge),
      }).expect(200);
      expect(res.body.user.id).toBe(account.userId);
    });

    it('keeps the second-factor and registration challenges of one user apart', async () => {
      const account = await register('second-flows');
      const authenticator = new SoftAuthenticator(RP_ID, ORIGIN);
      await addPasskey(account, authenticator);
      await enableTotp(account);

      // A registration challenge, issued last, answered as the second factor.
      const browser = newBrowser();
      await login(browser, account).expect(200);
      const registration = await as(account, 'post', '/auth/passkeys/registration-options')
        .send({ password: PASSWORD })
        .expect(200);
      await login(browser, account, {
        twoFactorPasskey: authenticator.assert(registration.body.challenge),
      }).expect(401);

      // A second-factor challenge, issued last, answered as a new passkey.
      await as(account, 'post', '/auth/passkeys/registration-options')
        .send({ password: PASSWORD })
        .expect(200);
      const secondFactor = (await login(browser, account).expect(200)).body.passkeyOptions.challenge;
      await as(account, 'post', '/auth/passkeys')
        .send({ name: 'Cross', credential: new SoftAuthenticator(RP_ID, ORIGIN).attest(secondFactor) })
        .expect(400);
    });

    it('refuses a replayed second-factor answer', async () => {
      const account = await register('second-replay');
      // No counter, so only the spent challenge can stop the replay.
      const authenticator = new SoftAuthenticator(RP_ID, ORIGIN, { counter: 0 });
      await addPasskey(account, authenticator);
      await enableTotp(account);
      const first = await request(server())
        .post('/auth/login')
        .send({ email: account.email, password: PASSWORD })
        .expect(200);
      // The flow cookie kept by hand: the browser drops it after the sign-in, an attacker would not.
      const flowCookie = flowCookieOf(first);
      const answer = authenticator.assert(first.body.passkeyOptions.challenge);
      const send = () =>
        request(server())
          .post('/auth/login')
          .set('Cookie', flowCookie)
          .send({ email: account.email, password: PASSWORD, twoFactorPasskey: answer });
      await send().expect(200);
      await send().expect(401);
    });

    it('still needs the right password', async () => {
      const account = await register('second-password');
      const authenticator = new SoftAuthenticator(RP_ID, ORIGIN);
      await addPasskey(account, authenticator);
      await enableTotp(account);
      const browser = newBrowser();
      const challenge = (await login(browser, account).expect(200)).body.passkeyOptions.challenge;
      await browser
        .post('/auth/login')
        .send({
          email: account.email,
          password: 'wrong-password',
          twoFactorPasskey: authenticator.assert(challenge),
        })
        .expect(401);
    });
  });

  describe('rename and remove', () => {
    it('renames only the caller’s own passkey and refuses a blank name', async () => {
      const account = await register('rename');
      const other = await register('rename-other');
      const passkey = await addPasskey(account, new SoftAuthenticator(RP_ID, ORIGIN));
      const renamed = await as(account, 'patch', `/auth/passkeys/${passkey.id}`)
        .send({ name: 'Phone' })
        .expect(200);
      expect(renamed.body.name).toBe('Phone');
      await as(account, 'patch', `/auth/passkeys/${passkey.id}`).send({ name: '   ' }).expect(400);
      await as(account, 'patch', `/auth/passkeys/${passkey.id}`)
        .send({ name: 'x'.repeat(61) })
        .expect(400);
      await as(other, 'patch', `/auth/passkeys/${passkey.id}`).send({ name: 'Mine now' }).expect(404);
    });

    it('removes a passkey after a password check, audits it, and it signs in no more', async () => {
      const account = await register('remove');
      const other = await register('remove-other');
      const authenticator = new SoftAuthenticator(RP_ID, ORIGIN);
      const passkey = await addPasskey(account, authenticator);
      await as(account, 'delete', `/auth/passkeys/${passkey.id}`)
        .send({ password: 'wrong-password' })
        .expect(403);
      await as(other, 'delete', `/auth/passkeys/${passkey.id}`).send({ password: PASSWORD }).expect(404);
      await as(account, 'delete', `/auth/passkeys/${passkey.id}`).send({ password: PASSWORD }).expect(200);
      expect((await as(account, 'get', '/auth/passkeys').expect(200)).body).toEqual([]);
      expect((await auditMeta(account.userId)).map(meta => meta.passkey)).toEqual(['added', 'removed']);

      const { browser, challenge } = await startSignIn();
      await browser
        .post('/auth/passkey-login')
        .send({ credential: authenticator.assert(challenge) })
        .expect(401);
    });
  });

  describe('rate limits', () => {
    let limitedApp: INestApplication;

    // A real in-memory store: the shared helper counts nothing.
    beforeAll(async () => {
      const moduleFixture = await Test.createTestingModule({ imports: [AppModule] })
        .overrideProvider(ThrottlerStorage)
        .useValue(new ThrottlerStorageService())
        .compile();
      limitedApp = moduleFixture.createNestApplication();
      limitedApp.useGlobalPipes(validationPipe());
      await limitedApp.init();
    });

    afterAll(async () => {
      await limitedApp.close();
    });

    it('limits the sign-in like the password login', async () => {
      const authenticator = new SoftAuthenticator(RP_ID, ORIGIN);
      const statuses: number[] = [];
      for (let i = 0; i < 7; i++) {
        const res = await request(limitedApp.getHttpServer())
          .post('/auth/passkey-login')
          .send({ credential: authenticator.assert('AAAA') });
        statuses.push(res.status);
      }
      expect(statuses).toContain(429);
    });

    it('limits the sign-in challenges', async () => {
      const statuses: number[] = [];
      for (let i = 0; i < 12; i++) {
        statuses.push((await request(limitedApp.getHttpServer()).post('/auth/passkey-login/options')).status);
      }
      expect(statuses).toContain(429);
    });
  });
});
