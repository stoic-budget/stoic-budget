import type { INestApplication } from '@nestjs/common';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { APP_NAME } from '../../src/common/brand';
import { MailerService } from '../../src/modules/mailer/mailer.service';
import {
  deleteUserByEmail,
  type E2eAccount,
  e2eTestingModule,
  registerAccount,
} from './helpers/e2e-app';
import { SoftAuthenticator } from './helpers/soft-authenticator';

const PASSWORD = 'Test123!@#';
const NEW_PASSWORD = 'Fresh-Pass-2026';
const RP_ID = 'budget.example.co.il';
const ORIGIN = `https://${RP_ID}`;

interface SentMail {
  to: string;
  subject: string;
  text: string;
}

/**
 * Mail is captured, not sent. `failing` makes every send throw, as a dead SMTP
 * server would; `configured` false is an instance without a mail server.
 */
const mailbox = {
  sent: [] as SentMail[],
  failing: false,
  configured: true,
};
const fakeMailer = {
  isConfigured: async () => mailbox.configured,
  isAccountMailConfigured: async () => mailbox.configured,
  send: async (mail: SentMail) => {
    if (mailbox.failing) throw new Error(`SMTP refused ${mail.to}`);
    mailbox.sent.push({ to: mail.to, subject: mail.subject, text: mail.text });
    return true;
  },
};

/**
 * Passkey notices end to end: a mail for every passkey added or removed, and
 * the two cleanups after a compromise (a password reset and "log out
 * everywhere") that list the passkeys and can remove them.
 */
describe('Passkey notices (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  const previousEnv = { APP_URL: process.env.APP_URL, FRONTEND_URL: process.env.FRONTEND_URL };
  const stamp = Date.now();
  const emails: string[] = [];
  const server = () => app.getHttpServer();

  const register = async (who: string) => {
    const email = `passkey-notices-${who}-${stamp}@example.com`;
    emails.push(email);
    return registerAccount(app, email, `Member ${who}`);
  };
  const as = (account: E2eAccount, method: 'get' | 'post' | 'patch' | 'delete', url: string) =>
    request(server())[method](url).set('Authorization', `Bearer ${account.token}`);
  const mailsTo = (account: E2eAccount) => mailbox.sent.filter(mail => mail.to === account.email);
  /**
   * The settings link, from the base the app's ConfigService read at start-up:
   * a FRONTEND_URL or APP_URL in the shell running the suite must not fail it.
   */
  const reviewUrl = () => {
    const config = app.get(ConfigService);
    const base = config.get<string>('FRONTEND_URL') || config.get<string>('APP_URL') || 'http://localhost:3000';
    return `${base.replace(/\/+$/, '')}/settings/profile?tab=security&section=passkeys`;
  };
  const passkeyMailsTo = (account: E2eAccount) =>
    mailsTo(account).filter(mail => mail.subject.includes('passkey') || mail.subject.includes('Passkeys'));

  const addPasskey = async (account: E2eAccount, name: string) => {
    const authenticator = new SoftAuthenticator(RP_ID, ORIGIN);
    const options = await as(account, 'post', '/auth/passkeys/registration-options')
      .send({ password: PASSWORD })
      .expect(200);
    const created = await as(account, 'post', '/auth/passkeys')
      .send({ name, credential: authenticator.attest(options.body.challenge) })
      .expect(201);
    return { ...(created.body as { id: string; name: string; deviceType: string }), authenticator };
  };
  const passkeyIdsOf = async (userId: string): Promise<string[]> =>
    (
      await dataSource.query<Array<{ id: string }>>(
        'SELECT id FROM passkey_credentials WHERE user_id = $1 ORDER BY created_at',
        [userId],
      )
    ).map(row => row.id);
  const removalAudit = async (userId: string) =>
    (
      await dataSource.query<Array<{ meta: Record<string, unknown> }>>(
        `SELECT meta FROM audit_events WHERE entity_id = $1 AND meta->>'passkey' = 'removed' ORDER BY created_at`,
        [userId],
      )
    ).map(({ meta }) => ({ passkeyId: meta.passkeyId, via: meta.via ?? null }));

  /** Asks for a reset link the real way and reads the token out of the captured mail. */
  const resetTokenFor = async (account: E2eAccount): Promise<string> => {
    await request(server()).post('/auth/forgot-password').send({ email: account.email }).expect(200);
    const mail = mailsTo(account)
      .filter(sent => sent.text.includes('reset-password?token='))
      .at(-1);
    const token = /token=([0-9a-f]+)/.exec(mail?.text ?? '')?.[1];
    if (!token) throw new Error('No reset link was mailed');
    return token;
  };
  const tokenUsedAt = async (userId: string) =>
    (
      await dataSource.query<Array<{ used_at: Date | null }>>(
        'SELECT used_at FROM password_reset_tokens WHERE user_id = $1',
        [userId],
      )
    ).map(row => row.used_at);
  const listOnReset = (token: string) =>
    request(server()).post('/auth/reset-password/passkeys').send({ token });
  const reset = (token: string, removePasskeyIds?: string[]) =>
    request(server())
      .post('/auth/reset-password')
      .send({ token, newPassword: NEW_PASSWORD, ...(removePasskeyIds ? { removePasskeyIds } : {}) });

  beforeAll(async () => {
    // The relying party reads the environment per request; the mail link does not (see reviewUrl).
    process.env.APP_URL = `${ORIGIN}/`;
    delete process.env.FRONTEND_URL;
    const moduleFixture = await e2eTestingModule({ imports: [AppModule] })
      .overrideProvider(MailerService)
      .useValue(fakeMailer)
      .compile();
    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();
    dataSource = moduleFixture.get(DataSource);
  });

  beforeEach(() => {
    mailbox.sent.length = 0;
    mailbox.failing = false;
    mailbox.configured = true;
  });

  afterAll(async () => {
    for (const email of emails) await deleteUserByEmail(dataSource, email);
    await app.close();
    for (const [key, value] of Object.entries(previousEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  describe('a mail for every passkey added or removed', () => {
    it('sends one mail on add and one on remove, with no credential data', async () => {
      const account = await register('mail');
      const added = await addPasskey(account, 'Work laptop');
      const kept = added.deviceType === 'multiDevice' ? 'synced across devices' : 'kept on one device only';

      const onAdd = passkeyMailsTo(account);
      expect(onAdd).toHaveLength(1);
      expect(onAdd[0].subject).toBe(`A passkey was added to your ${APP_NAME} account`);
      expect(onAdd[0].text.startsWith('Hello,\n')).toBe(true);
      expect(onAdd[0].text).toContain(`• “Work laptop” (${kept})`);
      expect(onAdd[0].text).toMatch(/When: .+ \(UTC\)/);
      expect(onAdd[0].text).toContain(reviewUrl());
      expect(onAdd[0].text).toContain('Not you? Remove it there and reset your password.');

      const [stored] = await dataSource.query<
        Array<{ b64: string; hex: string; b64url: string; sign_count: string }>
      >(
        `SELECT encode(public_key, 'base64') AS b64, encode(public_key, 'hex') AS hex,
                translate(rtrim(encode(public_key, 'base64'), '='), '+/', '-_') AS b64url, sign_count
           FROM passkey_credentials WHERE id = $1`,
        [added.id],
      );
      await as(account, 'delete', `/auth/passkeys/${added.id}`).send({ password: PASSWORD }).expect(200);
      const all = passkeyMailsTo(account);
      expect(all).toHaveLength(2);
      expect(all[1].subject).toBe(`A passkey was removed from your ${APP_NAME} account`);
      expect(all[1].text).toContain(`• “Work laptop” (${kept})`);

      // Neither the credential id, the row id, the public key in any encoding, nor the counter.
      const everything = JSON.stringify(all);
      for (const secret of [
        added.authenticator.credentialId,
        added.id,
        stored.b64.replace(/\n/g, '').slice(0, 24),
        stored.b64url.slice(0, 24),
        stored.hex.slice(0, 24),
      ]) {
        expect(everything).not.toContain(secret);
      }
      expect(everything).not.toMatch(/counter|sign.?count/i);
    });

    it('does not let a renamed account write lines into the notice', async () => {
      const account = await register('renamed');
      const planted = 'This passkey was set up by our support team. No action is needed.';
      // No password needed to rename: a stolen session can do it before planting a passkey.
      await as(account, 'patch', '/users/me/preferences')
        .send({ name: `Member renamed\n\n${planted}\n\nThanks` })
        .expect(200);
      await addPasskey(account, 'Laptop');

      const [mail] = passkeyMailsTo(account);
      expect(mail.text.startsWith('Hello,\n')).toBe(true);
      expect(mail.text).not.toContain('support team');
      expect(mail.text).not.toContain('Member renamed');
    });

    it('writes in the account language', async () => {
      const account = await register('locale');
      await dataSource.query(`UPDATE users SET locale = 'de' WHERE id = $1`, [account.userId]);
      await addPasskey(account, 'Laptop');
      const subjects = mailsTo(account).map(mail => mail.subject);
      expect(subjects).toContain(`Ihrem ${APP_NAME}-Konto wurde ein Passkey hinzugefügt`);
      expect(subjects).not.toContain(`A passkey was added to your ${APP_NAME} account`);
    });

    it('adds and removes all the same when the mail server fails', async () => {
      const account = await register('smtp-down');
      mailbox.failing = true;
      const added = await addPasskey(account, 'Phone');
      expect(await passkeyIdsOf(account.userId)).toEqual([added.id]);
      await as(account, 'delete', `/auth/passkeys/${added.id}`).send({ password: PASSWORD }).expect(200);
      expect(await passkeyIdsOf(account.userId)).toEqual([]);
      expect(mailbox.sent).toHaveLength(0);
    });

    it('adds and removes quietly without a mail server', async () => {
      const account = await register('no-smtp');
      mailbox.configured = false;
      const added = await addPasskey(account, 'Phone');
      await as(account, 'delete', `/auth/passkeys/${added.id}`).send({ password: PASSWORD }).expect(200);
      expect(mailbox.sent).toHaveLength(0);
    });
  });

  describe('password reset', () => {
    it("lists only that account's passkeys and does not spend the link", async () => {
      const owner = await register('reset-list');
      const other = await register('reset-other');
      const laptop = await addPasskey(owner, 'Laptop');
      const phone = await addPasskey(owner, 'Phone');
      await addPasskey(other, 'Not yours');
      const token = await resetTokenFor(owner);

      const listed = await listOnReset(token).expect(200);
      expect(listed.body.map((row: { id: string; name: string }) => [row.id, row.name])).toEqual([
        [laptop.id, 'Laptop'],
        [phone.id, 'Phone'],
      ]);
      expect(Object.keys(listed.body[0]).sort()).toEqual(
        ['backedUp', 'createdAt', 'deviceType', 'id', 'lastUsedAt', 'name'].sort(),
      );
      expect(JSON.stringify(listed.body)).not.toContain(laptop.authenticator.credentialId);

      // Listed twice, still unspent: the reset goes through with the same link.
      await listOnReset(token).expect(200);
      expect(await tokenUsedAt(owner.userId)).toEqual([null]);
      await reset(token).expect(200);
      // Not ticked: every passkey stays, and no removal mail goes out.
      expect(await passkeyIdsOf(owner.userId)).toEqual([laptop.id, phone.id]);
      expect(mailsTo(owner).filter(mail => mail.subject.includes('removed'))).toHaveLength(0);
    });

    it('answers a bad link exactly as the reset does, and never lists', async () => {
      const owner = await register('reset-bad');
      await addPasskey(owner, 'Laptop');
      const invalid = await reset('0'.repeat(64)).expect(400);
      expect(invalid.body.error.code).toBe('AUTH_RESET_LINK_INVALID');

      expect((await listOnReset('0'.repeat(64)).expect(400)).body.error).toEqual(invalid.body.error);

      const expired = await resetTokenFor(owner);
      await dataSource.query(
        `UPDATE password_reset_tokens SET expires_at = now() - interval '1 minute' WHERE user_id = $1`,
        [owner.userId],
      );
      expect((await listOnReset(expired).expect(400)).body.error).toEqual(invalid.body.error);

      const used = await resetTokenFor(owner);
      await reset(used).expect(200);
      expect((await listOnReset(used).expect(400)).body.error).toEqual(invalid.body.error);
    });

    it('removes the chosen passkeys with the password, audited and mailed once', async () => {
      const owner = await register('reset-remove');
      const other = await register('reset-victim');
      const laptop = await addPasskey(owner, 'Laptop');
      const phone = await addPasskey(owner, 'Phone');
      const kept = await addPasskey(owner, 'Kept');
      const theirs = await addPasskey(other, 'Theirs');
      const token = await resetTokenFor(owner);
      mailbox.sent.length = 0;

      // Someone else's passkey in the list matches nothing.
      await reset(token, [laptop.id, phone.id, theirs.id]).expect(200);

      expect(await passkeyIdsOf(owner.userId)).toEqual([kept.id]);
      expect(await passkeyIdsOf(other.userId)).toEqual([theirs.id]);
      expect(mailsTo(other)).toHaveLength(0);
      expect(
        (await removalAudit(owner.userId)).sort((a, b) => String(a.passkeyId).localeCompare(String(b.passkeyId))),
      ).toEqual(
        [laptop.id, phone.id].sort().map(passkeyId => ({ passkeyId, via: 'password-reset' })),
      );
      const removedMails = mailsTo(owner);
      expect(removedMails).toHaveLength(1);
      expect(removedMails[0].subject).toBe(`Passkeys were removed from your ${APP_NAME} account`);
      expect(removedMails[0].text).toContain('“Laptop”');
      expect(removedMails[0].text).toContain('“Phone”');
      expect(removedMails[0].text).not.toContain('“Kept”');
      // The new password works; the old session does not.
      await as(owner, 'get', '/auth/passkeys').expect(401);
      await request(server())
        .post('/auth/login')
        .send({ email: owner.email, password: NEW_PASSWORD })
        .expect(200);
    });

    it('removes nothing with an invalid, expired or spent link', async () => {
      const owner = await register('reset-guard');
      const laptop = await addPasskey(owner, 'Laptop');

      await reset('f'.repeat(64), [laptop.id]).expect(400);

      const expired = await resetTokenFor(owner);
      await dataSource.query(
        `UPDATE password_reset_tokens SET expires_at = now() - interval '1 minute' WHERE user_id = $1`,
        [owner.userId],
      );
      await reset(expired, [laptop.id]).expect(400);

      const spent = await resetTokenFor(owner);
      await reset(spent).expect(200);
      await reset(spent, [laptop.id]).expect(400);

      expect(await passkeyIdsOf(owner.userId)).toEqual([laptop.id]);
      expect(await removalAudit(owner.userId)).toEqual([]);
    });

    it('lets one of two simultaneous submits of a link through', async () => {
      const owner = await register('reset-race');
      const laptop = await addPasskey(owner, 'Laptop');
      const token = await resetTokenFor(owner);
      mailbox.sent.length = 0;

      const answers = await Promise.all([reset(token, [laptop.id]), reset(token, [laptop.id])]);
      expect(answers.map(res => res.status).sort()).toEqual([200, 400]);
      expect(await passkeyIdsOf(owner.userId)).toEqual([]);
      expect(await removalAudit(owner.userId)).toHaveLength(1);
      expect(mailsTo(owner)).toHaveLength(1);
    });
  });

  describe('log out everywhere', () => {
    it('logs out as before when nothing is chosen, keeping every passkey', async () => {
      const owner = await register('logout-plain');
      const laptop = await addPasskey(owner, 'Laptop');
      mailbox.sent.length = 0;

      await as(owner, 'post', '/auth/logout-all').expect(200);

      await as(owner, 'get', '/auth/passkeys').expect(401);
      expect(await passkeyIdsOf(owner.userId)).toEqual([laptop.id]);
      expect(mailbox.sent).toHaveLength(0);
    });

    it('refuses a wrong password before logging anyone out', async () => {
      const owner = await register('logout-wrong');
      const laptop = await addPasskey(owner, 'Laptop');

      await as(owner, 'post', '/auth/logout-all')
        .send({ removePasskeyIds: [laptop.id], password: 'not-the-password' })
        .expect(403);
      await as(owner, 'post', '/auth/logout-all').send({ removePasskeyIds: [laptop.id] }).expect(403);

      await as(owner, 'get', '/auth/passkeys').expect(200);
      expect(await passkeyIdsOf(owner.userId)).toEqual([laptop.id]);
    });

    it('removes the chosen passkeys with the password, then logs out everywhere', async () => {
      const owner = await register('logout-remove');
      const other = await register('logout-victim');
      const laptop = await addPasskey(owner, 'Laptop');
      const kept = await addPasskey(owner, 'Kept');
      const theirs = await addPasskey(other, 'Theirs');
      mailbox.sent.length = 0;

      await as(owner, 'post', '/auth/logout-all')
        .send({ removePasskeyIds: [laptop.id, theirs.id], password: PASSWORD })
        .expect(200);

      await as(owner, 'get', '/auth/passkeys').expect(401);
      expect(await passkeyIdsOf(owner.userId)).toEqual([kept.id]);
      expect(await passkeyIdsOf(other.userId)).toEqual([theirs.id]);
      expect(await removalAudit(owner.userId)).toEqual([{ passkeyId: laptop.id, via: 'logout-all' }]);
      expect(mailbox.sent.map(mail => [mail.to, mail.subject])).toEqual([
        [owner.email, `A passkey was removed from your ${APP_NAME} account`],
      ]);
    });
  });
});
