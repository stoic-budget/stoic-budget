import type { Mock } from 'vitest';
import * as nodemailerMock from 'nodemailer';
vi.mock('franc', () => ({
  franc: () => 'und',
}));

// No mail leaves the test: the transport records the server it was built for,
// the credentials it would log in with and every message it would send.
vi.mock('nodemailer', () => {
  const sendMail = vi.fn(async () => ({ messageId: 'test' }));
  const verify = vi.fn(async () => true);
  const mock = {
    createTransport: vi.fn(() => ({ sendMail, verify })),
    sendMail,
    verify,
  };
  // The services import nodemailer's default export.
  return { ...mock, default: mock };
});

import { randomUUID } from 'node:crypto';
import { type INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { ThrottlerStorage, ThrottlerStorageService } from '@nestjs/throttler';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { BackupArchiveService } from '../../src/modules/backups/backup-archive.service';
import {
  deleteUserByEmail,
  type E2eAccount,
  e2eTestingModule,
  registerAccount,
} from './helpers/e2e-app';

// vi.mock above replaces the module, so this import is the mock.
const transport = nodemailerMock as unknown as {
  createTransport: Mock;
  sendMail: Mock;
  verify: Mock;
};

/** `registerAccount` signs every account up with this password. */
const ACCOUNT_PASSWORD = 'Test123!@#';
const WRONG_PASSWORD = 'Wrong-guess-123';

/**
 * The owner's workspace SMTP server sends their own password-reset mail, so
 * saving it asks for the account password: with only a session (stolen cookie,
 * API key) nobody can point it at a server they read and collect the reset
 * link. A save for another server never carries the stored SMTP password there.
 */
describe('SMTP settings need the account password (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  const email = `smtp-password-${Date.now()}@example.com`;
  let owner: E2eAccount;
  const ownServer = {
    host: '1.1.1.1',
    port: 587,
    user: 'smtp-login-1',
    from: 'Member One <noreply@example.com>',
  };
  const storedPass = 'stored-smtp-secret-1';
  const otherHost = '8.8.8.8';

  const putSmtp = (body: object) =>
    request(app.getHttpServer())
      .put('/settings/email/smtp')
      .set('Authorization', `Bearer ${owner.token}`)
      .set('x-workspace-id', owner.workspaceId)
      .send(body);
  const storedRow = async () => {
    const [row] = await dataSource.query(
      `SELECT config, encrypted_secrets FROM workspace_service_settings
       WHERE workspace_id = $1 AND key = 'smtp'`,
      [owner.workspaceId],
    );
    return row as { config: Record<string, unknown>; encrypted_secrets: object } | undefined;
  };
  /** The server and login of every transport built since the last clear. */
  const transports = () =>
    transport.createTransport.mock.calls.map(([options]) => ({
      host: options.host,
      auth: options.auth,
    }));
  const clearSmtpRow = () =>
    dataSource.query(
      `DELETE FROM workspace_service_settings WHERE workspace_id = $1 AND key = 'smtp'`,
      [owner.workspaceId],
    );

  beforeAll(async () => {
    const moduleFixture: TestingModule = await e2eTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    dataSource = moduleFixture.get(DataSource);
    owner = await registerAccount(app, email, 'Member One');
  });

  beforeEach(async () => {
    await clearSmtpRow();
    transport.createTransport.mockClear();
    transport.sendMail.mockClear();
    transport.verify.mockClear();
  });

  afterAll(async () => {
    if (dataSource) {
      await dataSource.query('DELETE FROM audit_events WHERE workspace_id = $1', [
        owner.workspaceId,
      ]);
      await deleteUserByEmail(dataSource, email);
    }
    await app.close();
  });

  it('refuses a save without the password (400) or with a wrong one (403): nothing saved, no server tried', async () => {
    const body = { ...ownServer, pass: storedPass };

    await putSmtp(body).expect(400);
    await putSmtp({ ...body, currentPassword: '' }).expect(400);
    const refused = await putSmtp({ ...body, currentPassword: WRONG_PASSWORD }).expect(403);

    expect(refused.body.error?.code ?? refused.body.code).toBe('AUTH_CURRENT_PASSWORD_INCORRECT');
    expect(await storedRow()).toBeUndefined();
    expect(transport.createTransport).not.toHaveBeenCalled();
    expect(transport.verify).not.toHaveBeenCalled();
  });

  it('saves with the right password and checks the server with the SMTP login', async () => {
    const res = await putSmtp({ ...ownServer, pass: storedPass, currentPassword: ACCOUNT_PASSWORD })
      .expect(200);

    expect(res.body.settings).toMatchObject({ host: ownServer.host, passConfigured: true });
    expect(JSON.stringify(res.body)).not.toContain(ACCOUNT_PASSWORD);
    expect(transports()).toEqual([
      { host: ownServer.host, auth: { user: ownServer.user, pass: storedPass } },
    ]);
    expect((await storedRow())?.config).not.toHaveProperty('currentPassword');
  });

  it('keeps the stored SMTP password for the same server, and never sends it to another', async () => {
    await putSmtp({ ...ownServer, pass: storedPass, currentPassword: ACCOUNT_PASSWORD }).expect(200);
    transport.createTransport.mockClear();

    await putSmtp({ ...ownServer, currentPassword: ACCOUNT_PASSWORD }).expect(200);
    expect(transports()).toEqual([
      { host: ownServer.host, auth: { user: ownServer.user, pass: storedPass } },
    ]);
    expect((await storedRow())?.encrypted_secrets).toHaveProperty('pass');
    transport.createTransport.mockClear();

    const moved = await putSmtp({ ...ownServer, host: otherHost, currentPassword: ACCOUNT_PASSWORD })
      .expect(200);

    expect(transports()).toEqual([{ host: otherHost, auth: undefined }]);
    expect(JSON.stringify(transport.createTransport.mock.calls)).not.toContain(storedPass);
    expect((await storedRow())?.encrypted_secrets).toEqual({});
    expect(moved.body.settings.passConfigured).toBe(false);
  });

  it('with only a session, the reset mail cannot be redirected to another server', async () => {
    await putSmtp({ ...ownServer, pass: storedPass, currentPassword: ACCOUNT_PASSWORD }).expect(200);
    transport.createTransport.mockClear();

    // The attacker holds the session but not the password.
    const redirect = { ...ownServer, host: otherHost, user: 'attacker-login', pass: 'x' };
    await putSmtp(redirect).expect(400);
    await putSmtp({ ...redirect, currentPassword: WRONG_PASSWORD }).expect(403);
    await request(app.getHttpServer())
      .post('/auth/forgot-password')
      .send({ email })
      .expect(200);

    expect(transports()).toEqual([
      { host: ownServer.host, auth: { user: ownServer.user, pass: storedPass } },
    ]);
    expect(transport.sendMail).toHaveBeenCalledTimes(1);
    expect(transport.sendMail.mock.calls[0][0]).toMatchObject({ to: email });
    expect((await storedRow())?.config).toMatchObject({ host: ownServer.host });
  });

  // Only a session and a second account: a restore names the restorer as the
  // SMTP row's saver without any password, and the chain below makes that
  // workspace the restorer's home. Account mail must still not use the row.
  describe('a server restored from a backup', () => {
    const stamp = Date.now();
    const victimEmail = `smtp-restore-victim-${stamp}@example.com`;
    const attackerEmail = `smtp-restore-attacker-${stamp}@example.com`;
    const plantedHost = '8.8.4.4';
    let restoredWorkspaceId: string | undefined;

    afterAll(async () => {
      if (!dataSource) return;
      if (restoredWorkspaceId) {
        await dataSource.query('DELETE FROM workspaces WHERE id = $1', [restoredWorkspaceId]);
      }
      for (const address of [victimEmail, attackerEmail]) {
        await deleteUserByEmail(dataSource, address);
      }
    });

    it('never sends the restorer\'s account mail, even once it is their home workspace', async () => {
      const victim = await registerAccount(app, victimEmail, 'Member Two');
      const attacker = await registerAccount(app, attackerEmail, 'Member Three');
      const as = (account: E2eAccount, req: request.Test) =>
        req.set('Authorization', `Bearer ${account.token}`);
      const server = () => app.getHttpServer();

      // 1. An archive anyone can build, with a password of their choosing.
      const archivePassword = 'archive-password-1';
      const sourceId = randomUUID();
      const archive = await new BackupArchiveService().create({
        password: archivePassword,
        workspace: { id: sourceId, name: 'Crafted' },
        collections: {
          workspace: [{ id: sourceId, name: 'Crafted', currency: 'USD' }],
          workspace_service_settings: [
            {
              id: randomUUID(),
              workspaceId: sourceId,
              key: 'smtp',
              config: { host: plantedHost, port: 587, from: 'Mail <noreply@example.com>' },
              updatedByUserId: victim.userId,
              accountMailUserId: victim.userId,
            },
          ],
        },
        files: [],
      });

      // 2. Restored with the victim's session.
      const preview = await as(victim, request(server()).post('/backups/import/preview'))
        .attach('file', archive, 'crafted.seneca-backup')
        .field('password', archivePassword)
        .expect(201);
      const restored = await as(
        victim,
        request(server()).post(`/backups/imports/${preview.body.importId}/restore`),
      )
        .attach('file', archive, 'crafted.seneca-backup')
        .field('password', archivePassword)
        .expect(201);
      restoredWorkspaceId = restored.body.workspaceId as string;
      const w2 = restoredWorkspaceId;
      const [row] = await dataSource.query(
        `SELECT config->>'host' AS host, updated_by_user_id, account_mail_user_id
         FROM workspace_service_settings WHERE workspace_id = $1 AND key = 'smtp'`,
        [w2],
      );
      expect(row).toEqual({
        host: plantedHost,
        updated_by_user_id: victim.userId,
        account_mail_user_id: null,
      });

      // 3. The attacker takes the restored workspace over and removes the victim.
      const toAttacker = await as(victim, request(server()).post(`/workspaces/${w2}/invitations`))
        .send({ email: attacker.email, role: 'admin' })
        .expect(201);
      await as(
        attacker,
        request(server()).post(`/workspaces/invitations/${toAttacker.body.invitation.token}/accept`),
      ).expect(200);
      await as(victim, request(server()).patch(`/workspaces/${w2}/members/${attacker.userId}/role`))
        .send({ role: 'owner' })
        .expect(200);
      await as(
        attacker,
        request(server()).delete(`/workspaces/${w2}/members/${victim.userId}`),
      ).expect(200);

      // 4. The victim's home workspace goes; 5. an invitation makes W2 their home.
      await as(victim, request(server()).delete(`/workspaces/${victim.workspaceId}`)).expect(200);
      const toVictim = await as(attacker, request(server()).post(`/workspaces/${w2}/invitations`))
        .send({ email: victim.email, role: 'member' })
        .expect(201);
      await as(
        victim,
        request(server()).post(`/workspaces/invitations/${toVictim.body.invitation.token}/accept`),
      ).expect(200);
      const [home] = await dataSource.query('SELECT workspace_id FROM users WHERE id = $1', [
        victim.userId,
      ]);
      expect(home.workspace_id).toBe(w2);
      transport.createTransport.mockClear();
      transport.sendMail.mockClear();

      // 6. The reset link.
      await request(server()).post('/auth/forgot-password').send({ email: victimEmail }).expect(200);

      expect(transports().map(({ host }) => host)).not.toContain(plantedHost);
    });
  });

  it('audits saves, refusals and removals with the server only, never a secret', async () => {
    await putSmtp({ ...ownServer, pass: storedPass, currentPassword: WRONG_PASSWORD }).expect(403);
    await putSmtp({ ...ownServer, pass: storedPass, currentPassword: ACCOUNT_PASSWORD }).expect(200);
    await request(app.getHttpServer())
      .delete('/settings/email/smtp')
      .set('Authorization', `Bearer ${owner.token}`)
      .set('x-workspace-id', owner.workspaceId)
      .expect(200);

    const rows: Array<{ actor_id: string; meta: Record<string, unknown>; diff: unknown }> =
      await dataSource.query(
        `SELECT actor_id, meta, diff FROM audit_events
         WHERE workspace_id = $1 AND meta ? 'smtp' ORDER BY created_at DESC LIMIT 3`,
        [owner.workspaceId],
      );
    const server = { host: ownServer.host, port: ownServer.port, from: ownServer.from };
    // The audit service adds its own `auditDescription`; nothing else goes in.
    const metas = rows.map(({ meta: { auditDescription: _, ...meta } }) => meta).reverse();
    expect(metas).toEqual([
      { smtp: 'refused', ...server },
      { smtp: 'saved', ...server },
      { smtp: 'removed', ...server },
    ]);
    expect(rows.every(row => row.diff === null)).toBe(true);
    expect(rows.every(row => row.actor_id === owner.userId)).toBe(true);
    const written = JSON.stringify(rows);
    for (const secret of [ownServer.user, storedPass, ACCOUNT_PASSWORD, WRONG_PASSWORD]) {
      expect(written).not.toContain(secret);
    }
  });

  describe('throttle', () => {
    let limitedApp: INestApplication;

    // Its own app with a real in-memory store: the shared helper counts nothing.
    beforeAll(async () => {
      const moduleFixture = await Test.createTestingModule({ imports: [AppModule] })
        .overrideProvider(ThrottlerStorage)
        .useValue(new ThrottlerStorageService())
        .compile();
      limitedApp = moduleFixture.createNestApplication();
      limitedApp.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
      await limitedApp.init();
    });

    afterAll(async () => {
      await limitedApp?.close();
    });

    it('allows 5 password guesses a minute', async () => {
      const statuses: number[] = [];
      // One after another, as in auth.e2e-spec: a parallel burst resets connections.
      for (let attempt = 0; attempt < 6; attempt++) {
        const res = await request(limitedApp.getHttpServer())
          .put('/settings/email/smtp')
          .set('Authorization', `Bearer ${owner.token}`)
          .set('x-workspace-id', owner.workspaceId)
          .send({ ...ownServer, currentPassword: `${WRONG_PASSWORD}-${attempt}` });
        statuses.push(res.status);
      }

      expect(statuses).toEqual([403, 403, 403, 403, 403, 429]);
    });
  });
});
