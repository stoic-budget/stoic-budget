import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { AuthService } from '../../src/modules/auth/auth.service';
import { PasswordResetService } from '../../src/modules/auth/password-reset.service';
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
  configureProvider,
  landing,
  signIn,
  startLink,
} from './helpers/oidc-flow';

/**
 * What a borrowed session, a password reset, a half-made account and a
 * changed provider must not leave behind.
 */
describe('Single sign-on account safety (e2e)', () => {
  const stamp = Date.now();
  const sub = (name: string) => `oidc-safety-${name}-${stamp}`;
  const adminEmail = `oidc-safety-admin-${stamp}@example.com`;
  const victimEmail = `oidc-safety-victim-${stamp}@example.com`;
  const createdEmails: string[] = [];
  const previousAppUrl = process.env.APP_URL;
  let app: INestApplication;
  let dataSource: DataSource;
  let provider: MockOidcProvider;
  let admin: E2eAccount;
  let victim: E2eAccount;

  const errorOf = (res: request.Response) => landing(res).searchParams.get('oidcError');
  const codeOf = (res: request.Response) => res.body.error?.code ?? res.body.code;
  const configure = (overrides: Record<string, unknown> = {}, target = provider) =>
    configureProvider(app, admin.token, target, overrides).then(res => {
      if (res.status !== 200) throw new Error(`${res.status} ${JSON.stringify(res.body)}`);
      return res;
    });
  const linkRequest = (token: string, body: object) =>
    request(app.getHttpServer())
      .post('/auth/oidc/link')
      .set('Authorization', `Bearer ${token}`)
      .send(body);
  const identitiesOf = (userId: string) =>
    dataSource.query('SELECT subject FROM user_identities WHERE user_id = $1', [userId]);
  const oidcEvents = (userId: string) =>
    dataSource.query(
      `SELECT meta FROM audit_events WHERE entity_id = $1 AND meta ? 'oidcEvent' ORDER BY created_at`,
      [userId],
    );
  /** The reset link the e-mail would carry, completed with a new password. */
  const resetPassword = async (email: string, userId: string, newPassword: string) => {
    await request(app.getHttpServer()).post('/auth/forgot-password').send({ email }).expect(200);
    const token = randomUUID();
    await dataSource.query('UPDATE password_reset_tokens SET token_hash = $1 WHERE user_id = $2', [
      app.get(PasswordResetService)['hashToken'](token),
      userId,
    ]);
    return request(app.getHttpServer())
      .post('/auth/reset-password')
      .send({ token, newPassword });
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
    victim = await registerAccount(app, victimEmail, 'Member One');
    await dataSource.query('UPDATE users SET role = $1 WHERE id = $2', ['admin', admin.userId]);
    await configure();
  });

  afterAll(async () => {
    vi.restoreAllMocks();
    await dataSource.query(`DELETE FROM instance_settings WHERE key = 'oidc'`);
    for (const email of [adminEmail, victimEmail, ...createdEmails]) {
      await deleteUserByEmail(dataSource, email);
    }
    await app.close();
    await provider.close();
    process.env.APP_URL = previousAppUrl;
  });

  describe('linking asks for the current password', () => {
    it('starts no link with a session alone', async () => {
      const missing = await linkRequest(victim.token, {});
      expect(missing.status).toBe(400);
      const wrong = await linkRequest(victim.token, { password: 'not-the-password' });
      expect(wrong.status).toBe(403);
      expect(codeOf(wrong)).toBe('AUTH_CURRENT_PASSWORD_INCORRECT');
      for (const res of [missing, wrong]) {
        expect(responseCookie(res, 'oidc_flow')).toBeUndefined();
        expect(res.body.url).toBeUndefined();
      }
      const events = await oidcEvents(victim.userId);
      expect(events.at(-1).meta).toMatchObject({
        oidcEvent: 'refused',
        reason: 'AUTH_CURRENT_PASSWORD_INCORRECT',
      });
      expect(JSON.stringify(events)).not.toContain('not-the-password');
    });

    it('links with the right password', async () => {
      const flow = await startLink(app, victim.token, ACCOUNT_PASSWORD);
      const back = await callback(app, flow, provider.authorize(flow.location, sub('victim')));
      expect(landing(back).searchParams.get('oidc')).toBe('linked');
      expect(await identitiesOf(victim.userId)).toEqual([{ subject: sub('victim') }]);
    });

    it('lets an account made by single sign-on link nothing more, having no password', async () => {
      await configure({ allowSignup: true });
      const email = `${sub('sso-made')}@example.com`;
      createdEmails.push(email);
      const made = await signIn(app, provider, sub('sso-made'));
      expect(made.completed?.status).toBe(200);
      const res = await linkRequest(made.token as string, { password: ACCOUNT_PASSWORD });
      expect(res.status).toBe(403);
      expect(codeOf(res)).toBe('AUTH_CURRENT_PASSWORD_INCORRECT');
      await configure();
    });
  });

  describe('a password reset', () => {
    it('unlinks every provider account of an account with a password', async () => {
      // The intruder links their own provider account while they know the password.
      const flow = await startLink(app, victim.token);
      await callback(app, flow, provider.authorize(flow.location, sub('intruder')));
      expect(await identitiesOf(victim.userId)).toHaveLength(2);

      const reset = await resetPassword(victimEmail, victim.userId, 'Brand-new 2nd pass');
      expect(reset.status).toBe(200);
      expect(await identitiesOf(victim.userId)).toEqual([]);

      // The intruder's provider account no longer opens the victim's account.
      const after = await signIn(app, provider, sub('intruder'));
      expect(after.completed).toBeNull();
      expect(errorOf(after.callback)).toBe('OIDC_SIGNUP_NOT_ALLOWED');

      const metas = (await oidcEvents(victim.userId)).map((row: { meta: object }) => row.meta);
      expect(metas.filter((meta: { oidcEvent: string }) => meta.oidcEvent === 'unlinked')).toHaveLength(2);
      const [resetEvent] = await dataSource.query(
        `SELECT meta FROM audit_events WHERE entity_id = $1 AND meta->>'password' = 'reset'`,
        [victim.userId],
      );
      expect(resetEvent.meta).toMatchObject({ singleSignOn: 'all-unlinked' });
    });

    it('keeps the identity of an account made by single sign-on', async () => {
      const email = `${sub('sso-made')}@example.com`;
      const [made] = await dataSource.query('SELECT id FROM users WHERE email = $1', [email]);
      const reset = await resetPassword(email, made.id, 'Brand-new 3rd pass');
      expect(reset.status).toBe(200);
      expect(await identitiesOf(made.id)).toEqual([{ subject: sub('sso-made') }]);
      const again = await signIn(app, provider, sub('sso-made'));
      expect(again.completed?.body.user.id).toBe(made.id);
    });
  });

  describe('a first sign-in whose workspace failed', () => {
    it('finishes the workspace on the next sign-in', async () => {
      await configure({ allowSignup: true });
      const email = `${sub('half-made')}@example.com`;
      createdEmails.push(email);
      const spy = vi
        .spyOn(app.get(AuthService), 'createOwnedWorkspaceForUser')
        .mockRejectedValueOnce(new Error('workspace store down'));
      try {
        const first = await signIn(app, provider, sub('half-made'));
        expect(first.completed).toBeNull();
        expect(errorOf(first.callback)).toEqual(expect.any(String));
      } finally {
        spy.mockRestore();
      }
      const [user] = await dataSource.query('SELECT id, workspace_id FROM users WHERE email = $1', [email]);
      expect(user.workspace_id).toBeNull();

      const second = await signIn(app, provider, sub('half-made'));
      expect(second.completed?.status).toBe(200);
      expect(second.completed?.body.user.workspaceId).toEqual(expect.any(String));
      const members = await dataSource.query(
        'SELECT role FROM workspace_members WHERE user_id = $1',
        [user.id],
      );
      expect(members).toEqual([{ role: 'owner' }]);
      await configure();
    });

    it('makes one workspace when two first sign-ins race', async () => {
      await configure({ allowSignup: true });
      const email = `${sub('racer')}@example.com`;
      createdEmails.push(email);
      const results = await Promise.all([
        signIn(app, provider, sub('racer')),
        signIn(app, provider, sub('racer')),
      ]);
      expect(results.map(result => result.completed?.status)).toEqual([200, 200]);
      const owned = await dataSource.query(
        'SELECT w.id FROM workspaces w JOIN users u ON u.id = w.owner_id WHERE u.email = $1',
        [email],
      );
      expect(owned).toHaveLength(1);
      await configure();
    });
  });

  describe('changing the provider', () => {
    it('does not send the stored secret to a new issuer', async () => {
      const other = await new MockOidcProvider().start();
      other.clientSecret = 'second-provider-secret-9876543210';
      try {
        const switched = await configure({ clientSecret: null }, other);
        expect(switched.body.clientSecretSet).toBe(false);
        await signIn(app, other, sub('switched'));
        const leaked = Buffer.from(`${provider.clientId}:${provider.clientSecret}`).toString('base64');
        expect(other.tokenAuthorizations.length).toBeGreaterThan(0);
        expect(other.tokenAuthorizations).not.toContain(`Basic ${leaked}`);
        expect(JSON.stringify(other.tokenAuthorizations)).not.toContain(leaked);

        // A new client id at the same issuer drops it too; the same pair keeps it.
        await configure();
        expect((await configure({ clientSecret: null })).body.clientSecretSet).toBe(true);
        const renamed = await configure({ clientId: 'another-client', clientSecret: null });
        expect(renamed.body.clientSecretSet).toBe(false);
      } finally {
        await other.close();
        await configure();
      }
    });
  });
});
