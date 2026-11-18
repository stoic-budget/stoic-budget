vi.mock('franc', () => ({
  franc: () => 'und',
}));

import { randomUUID } from 'node:crypto';
import { type INestApplication, Logger, ValidationPipe } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { hashFeedToken } from '../../src/modules/calendar-feed/calendar-feed.service';
import { PasswordResetService } from '../../src/modules/auth/password-reset.service';
import {
  accessTokenOf,
  deleteUserByEmail,
  type E2eAccount,
  e2eTestingModule,
  registerAccount,
} from './helpers/e2e-app';

/** What `registerAccount` signs up with. */
const PASSWORD = 'Test123!@#';

/**
 * A calendar feed link is a credential: its token stays out of the logs and
 * the audit trail, making and ending one is audited, and taking an account
 * back (log out everywhere, a password reset, a deactivation) ends its links
 * in every workspace.
 */
describe('Calendar feed security (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  const stamp = Date.now();
  const emails = {
    owner: `calsec-owner-${stamp}@example.com`,
    member: `calsec-member-${stamp}@example.com`,
  };
  let owner: E2eAccount;
  let member: E2eAccount;

  const server = () => app.getHttpServer();
  const as = (account: E2eAccount, req: request.Test, workspaceId = account.workspaceId) =>
    req.set('Authorization', `Bearer ${account.token}`).set('x-workspace-id', workspaceId);
  const feed = (token: string) => request(server()).get(`/public/calendar/${token}.ics`);
  const issue = async (account: E2eAccount, workspaceId = account.workspaceId) =>
    (await as(account, request(server()).post('/calendar-feed'), workspaceId).send({}).expect(201))
      .body.token as string;
  const feedRows = async (userId: string) =>
    dataSource.query(
      `SELECT f.id FROM calendar_feeds f JOIN workspace_members m ON m.id = f.member_id
        WHERE m.user_id = $1`,
      [userId],
    );

  /** The member's feeds in their own workspace and in the owner's, from a fresh login. */
  async function twoFeeds(): Promise<string[]> {
    // A fresh session: an earlier test may have ended the previous one.
    member = await login(member);
    const tokens = [await issue(member), await issue(member, owner.workspaceId)];
    for (const token of tokens) await feed(token).expect(200);
    expect(await feedRows(member.userId)).toHaveLength(2);
    return tokens;
  }

  async function expectRevoked(tokens: string[]): Promise<void> {
    for (const token of tokens) await feed(token).expect(404);
    expect(await feedRows(member.userId)).toHaveLength(0);
  }

  async function login(account: E2eAccount): Promise<E2eAccount> {
    const res = await request(server())
      .post('/auth/login')
      .send({ email: account.email, password: PASSWORD })
      .expect(200);
    return { ...account, token: accessTokenOf(res) };
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await e2eTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    dataSource = moduleFixture.get(DataSource);

    owner = await registerAccount(app, emails.owner, 'Member One');
    member = await registerAccount(app, emails.member, 'Member Two');
    const invite = await as(
      owner,
      request(server()).post(`/workspaces/${owner.workspaceId}/invitations`),
    )
      .send({ email: member.email, role: 'member' })
      .expect(201);
    await request(server())
      .post(`/workspaces/invitations/${invite.body.invitation.token}/accept`)
      .set('Authorization', `Bearer ${member.token}`)
      .expect(200);
  }, 120_000);

  afterAll(async () => {
    if (dataSource) {
      for (const email of Object.values(emails)) await deleteUserByEmail(dataSource, email);
    }
    await app?.close();
  });

  it('never writes a feed or shared-invoice token to the logs', async () => {
    const client = await as(owner, request(server()).post('/clients'))
      .send({ name: 'Client Beta', email: 'member-1@example.com', currency: 'EUR' })
      .expect(201);
    await as(owner, request(server()).put('/business-profile'))
      .send({ legalName: 'Example Studio', addressLines: '1 Example Street' })
      .expect(200);
    const invoice = await as(owner, request(server()).post('/invoices'))
      .send({
        clientId: client.body.id,
        issueDate: new Date().toISOString().slice(0, 10),
        dueDate: new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10),
        currency: 'EUR',
        lineItems: [{ description: 'Design work', quantity: 1, unitPrice: 300 }],
      })
      .expect(201);
    await as(owner, request(server()).put(`/invoices/${invoice.body.id}/send`)).expect(200);
    const [{ share_token: shareToken }] = await dataSource.query(
      'SELECT share_token FROM invoices WHERE id = $1',
      [invoice.body.id],
    );
    const feedToken = await issue(owner);

    const spies = (['log', 'warn', 'error', 'debug', 'verbose'] as const).map(level =>
      vi.spyOn(Logger.prototype, level),
    );
    try {
      await feed(feedToken).expect(200);
      await request(server()).get(`/public/invoices/${shareToken}`).expect(200);
      const lines = JSON.stringify(spies.map(spy => spy.mock.calls));
      // The requests were logged, by their route pattern.
      expect(lines).toContain('/public/calendar/:token.ics');
      expect(lines).toContain('/public/invoices/:token');
      expect(lines).not.toContain(feedToken);
      expect(lines).not.toContain(shareToken);
    } finally {
      for (const spy of spies) spy.mockRestore();
    }
  });

  it('audits making, renewing and turning off a link, without the token or its hash', async () => {
    await as(owner, request(server()).delete('/calendar-feed')).expect(200);
    const made = await issue(owner);
    const renewed = await issue(owner);
    await as(owner, request(server()).delete('/calendar-feed')).expect(200);

    const trail = await as(
      owner,
      request(server()).get('/audit-events?entityType=calendar_feed&limit=50'),
    ).expect(200);
    const events = trail.body.data as Array<{ action: string; actorId: string; severity: string }>;
    const actions = events.map(event => event.action);
    expect(actions.filter(action => action === 'create').length).toBeGreaterThanOrEqual(2);
    expect(actions).toContain('update');
    expect(actions.filter(action => action === 'delete').length).toBeGreaterThanOrEqual(2);
    for (const event of events) {
      expect(event).toMatchObject({ actorId: owner.userId, severity: 'warn' });
    }
    const stored = JSON.stringify(
      await dataSource.query(
        `SELECT * FROM audit_events WHERE workspace_id = $1 AND entity_type = 'calendar_feed'`,
        [owner.workspaceId],
      ),
    );
    for (const secret of [made, renewed, hashFeedToken(made), hashFeedToken(renewed)]) {
      expect(stored).not.toContain(secret);
    }
  });

  it('ends every link of the account on "log out everywhere"', async () => {
    const tokens = await twoFeeds();
    await as(member, request(server()).post('/auth/logout-all')).expect(200);
    await expectRevoked(tokens);
  });

  it('ends every link of the account on a password reset', async () => {
    const tokens = await twoFeeds();
    await request(server()).post('/auth/forgot-password').send({ email: member.email }).expect(200);
    const resetToken = randomUUID();
    await dataSource.query('UPDATE password_reset_tokens SET token_hash = $1 WHERE user_id = $2', [
      app.get(PasswordResetService)['hashToken'](resetToken),
      member.userId,
    ]);
    await request(server())
      .post('/auth/reset-password')
      .send({ token: resetToken, newPassword: PASSWORD })
      .expect(200);
    await expectRevoked(tokens);
  });

  it('ends every link of a deactivated account; reactivating does not revive them', async () => {
    const tokens = await twoFeeds();
    await dataSource.query(`UPDATE users SET role = 'admin' WHERE id = $1`, [owner.userId]);
    await as(owner, request(server()).put(`/users/${member.userId}`))
      .send({ isActive: false })
      .expect(200);
    expect(await feedRows(member.userId)).toHaveLength(0);
    await as(owner, request(server()).put(`/users/${member.userId}`))
      .send({ isActive: true })
      .expect(200);
    await expectRevoked(tokens);
  });
});
