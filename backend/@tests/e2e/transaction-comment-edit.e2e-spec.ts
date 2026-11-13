vi.mock('franc', () => ({
  franc: () => 'und',
}));

import { type INestApplication, ValidationPipe } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { Transaction, TransactionType } from '../../src/entities/transaction.entity';
import { User, UserRole } from '../../src/entities/user.entity';
import {
  deleteUserByEmail,
  type E2eAccount,
  e2eTestingModule,
  registerAccount,
} from './helpers/e2e-app';

/**
 * Anyone in the household may rewrite a row's comment; the drawer then says
 * who did, quietly. Never for a comment the viewer cannot read, and never an
 * e-mail in place of a name.
 */
describe('Who edited a transaction comment (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  const stamp = Date.now();
  const emails = {
    owner: `comment-edit-owner-${stamp}@example.com`,
    partner: `comment-edit-partner-${stamp}@example.com`,
    other: `comment-edit-other-${stamp}@example.com`,
  };
  const names = { owner: 'Member One', partner: 'Member Two' };
  let owner: E2eAccount;
  let partner: E2eAccount;
  let other: E2eAccount;
  let partnerMemberId: string;

  const as = (account: E2eAccount, req: request.Test) =>
    req.set('Authorization', `Bearer ${account.token}`).set('x-workspace-id', owner.workspaceId);
  const server = () => app.getHttpServer();
  const commentEdit = async (account: E2eAccount, rowId: string) =>
    (await as(account, request(server()).get(`/transactions/${rowId}/comment-edit`)).expect(200))
      .body;
  const setComment = (account: E2eAccount, rowId: string, comments: string | null) =>
    as(account, request(server()).put(`/transactions/${rowId}`)).send({ comments }).expect(200);

  async function newRow(comments: string | null, payee = 'ACME Store'): Promise<string> {
    const repository = dataSource.getRepository(Transaction);
    const row = await repository.save(
      repository.create({
        workspaceId: owner.workspaceId,
        transactionDate: new Date('2026-05-10'),
        counterpartyName: payee,
        paymentPurpose: `${payee} - Wireless Buds`,
        debit: 30,
        amount: 30,
        currency: 'EUR',
        transactionType: TransactionType.EXPENSE,
        comments,
      }),
    );
    return row.id;
  }

  const storedComment = async (rowId: string) =>
    (await dataSource.getRepository(Transaction).findOneByOrFail({ id: rowId })).comments;
  /** The row's changes, oldest first, as the audit log holds them. */
  const updateEvents = async (rowId: string): Promise<string[]> =>
    (
      await dataSource.query(
        `SELECT id FROM audit_events WHERE entity_id = $1 AND action = 'update' ORDER BY created_at`,
        [rowId],
      )
    ).map((row: { id: string }) => row.id);
  const rollback = (eventId: string) =>
    as(owner, request(server()).post(`/audit-events/${eventId}/rollback`)).expect(201);

  beforeAll(async () => {
    const moduleFixture: TestingModule = await e2eTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    dataSource = moduleFixture.get<DataSource>(DataSource);

    owner = await registerAccount(app, emails.owner, names.owner);
    partner = await registerAccount(app, emails.partner, names.partner);
    other = await registerAccount(app, emails.other, 'Member Three');

    const invite = await as(
      owner,
      request(server()).post(`/workspaces/${owner.workspaceId}/invitations`),
    )
      .send({ email: partner.email, role: 'member', permissions: { canEditStatements: true } })
      .expect(201);
    await request(server())
      .post(`/workspaces/invitations/${invite.body.invitation.token}/accept`)
      .set('Authorization', `Bearer ${partner.token}`)
      .expect(200);
    const [member] = await dataSource.query(
      'SELECT id FROM workspace_members WHERE workspace_id = $1 AND user_id = $2',
      [owner.workspaceId, partner.userId],
    );
    partnerMemberId = member.id;
    // Rolling back from the activity log is an app admin's.
    await dataSource.getRepository(User).update({ email: emails.owner }, { role: UserRole.ADMIN });
  });

  afterAll(async () => {
    if (dataSource) {
      for (const email of Object.values(emails)) {
        await deleteUserByEmail(dataSource, email);
      }
    }
    await app.close();
  });

  it('says nothing about a comment that came with the row', async () => {
    const rowId = await newRow('Imported note');
    // Another field changing is not an edit of the comment.
    await as(owner, request(server()).put(`/transactions/${rowId}`))
      .send({ counterpartyName: 'ACME Store Online' })
      .expect(200);

    expect(await commentEdit(owner, rowId)).toEqual({ edit: null });
  });

  it('says "you" to the one who edited, and their name to everyone else', async () => {
    const rowId = await newRow('Imported note');
    await setComment(owner, rowId, 'Team coffee');

    expect((await commentEdit(owner, rowId)).edit).toEqual({
      at: expect.any(String),
      by: 'you',
      name: null,
    });
    expect((await commentEdit(partner, rowId)).edit).toMatchObject({
      by: 'member',
      name: names.owner,
    });
  });

  it("names the partner who rewrote the owner's comment, cleared or not", async () => {
    const rowId = await newRow(null);
    await setComment(owner, rowId, 'Team coffee');
    await setComment(partner, rowId, null);

    const answer = (await commentEdit(owner, rowId)).edit;
    expect(answer).toMatchObject({ by: 'member', name: names.partner });
    expect(JSON.stringify(answer)).not.toContain(emails.partner);
    expect((await commentEdit(partner, rowId)).edit).toMatchObject({ by: 'you' });
  });

  it("tells nothing about another member's private row, though they edited its comment", async () => {
    const rowId = await newRow('Imported note');
    await as(owner, request(server()).put(`/transactions/${rowId}`))
      .send({ ownerMemberId: partnerMemberId })
      .expect(200);
    await as(partner, request(server()).put(`/transactions/${rowId}`))
      .send({ isPrivate: true })
      .expect(200);
    await setComment(partner, rowId, 'A gift');

    expect((await commentEdit(partner, rowId)).edit).toMatchObject({ by: 'you' });
    expect(await commentEdit(owner, rowId)).toEqual({ edit: null });
  });

  it("is not another workspace's to read", async () => {
    const rowId = await newRow('Imported note');
    await setComment(owner, rowId, 'Team coffee');

    await request(server())
      .get(`/transactions/${rowId}/comment-edit`)
      .set('Authorization', `Bearer ${other.token}`)
      .set('x-workspace-id', other.workspaceId)
      .expect(404);
  });

  it('names nobody once a rule run filled the comment the partner had cleared', async () => {
    const payee = 'Example Rule Shop';
    const rowId = await newRow(null, payee);
    await setComment(partner, rowId, 'Lunch');
    await setComment(partner, rowId, null);
    expect((await commentEdit(owner, rowId)).edit).toMatchObject({ name: names.partner });

    await as(owner, request(server()).post('/categorization-rules'))
      .send({
        name: 'Note the rule shop',
        conditions: [{ field: 'counterparty_name', operator: 'contains', value: payee }],
        result: { comment: 'Filled by a rule' },
      })
      .expect(201);
    await as(owner, request(server()).post(`/classification/transaction/${rowId}`)).expect(200);

    expect(await storedComment(rowId)).toBe('Filled by a rule');
    expect(await commentEdit(owner, rowId)).toEqual({ edit: null });
  });

  it('names nobody once a rollback of an older change put an older comment back', async () => {
    const rowId = await newRow(null);
    await as(owner, request(server()).put(`/transactions/${rowId}`))
      .send({ counterpartyName: 'ACME Store Online' })
      .expect(200);
    await setComment(partner, rowId, 'Lunch');
    const [renamed] = await updateEvents(rowId);

    await rollback(renamed);

    // The change it undid had no comment in it, but its snapshot did.
    expect(await storedComment(rowId)).toBeNull();
    expect(await commentEdit(owner, rowId)).toEqual({ edit: null });
  });

  it('names whoever rolled the comment back, as an edit of their own', async () => {
    const rowId = await newRow(null);
    await setComment(owner, rowId, 'Team coffee');
    await setComment(partner, rowId, 'Lunch');
    const [, rewritten] = await updateEvents(rowId);

    await rollback(rewritten);

    expect(await storedComment(rowId)).toBe('Team coffee');
    expect((await commentEdit(owner, rowId)).edit).toMatchObject({ by: 'you' });
    expect((await commentEdit(partner, rowId)).edit).toMatchObject({
      by: 'member',
      name: names.owner,
    });
  });

  // Last: the partner leaves the workspace.
  it('drops the name of a member who has left, and still says it was edited', async () => {
    const rowId = await newRow('Imported note');
    await setComment(partner, rowId, 'Lunch');
    await as(
      owner,
      request(server()).delete(`/workspaces/${owner.workspaceId}/members/${partner.userId}`),
    ).expect(200);

    expect((await commentEdit(owner, rowId)).edit).toEqual({
      at: expect.any(String),
      by: 'member',
      name: null,
    });
  });
});
