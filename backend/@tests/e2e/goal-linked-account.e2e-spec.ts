vi.mock('franc', () => ({
  franc: () => 'und',
}));

import { type INestApplication, ValidationPipe } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import { Schema } from 'effect';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { GoalDetail, GoalPlanResponse, GoalWithProgress } from '../../src/contracts';
import { User, UserRole } from '../../src/entities/user.entity';
import {
  deleteUserByEmail,
  type E2eAccount,
  e2eTestingModule,
  registerAccount,
} from './helpers/e2e-app';

/**
 * A goal that follows an account: its progress is the account's balance, its
 * contributions are kept but not counted, and only an active account of the
 * same workspace that is shared or the linker's own can be followed.
 */
describe('Goal following an account (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  const stamp = Date.now();
  const emails = {
    owner: `goal-account-owner-${stamp}@example.com`,
    partner: `goal-account-partner-${stamp}@example.com`,
    stranger: `goal-account-stranger-${stamp}@example.com`,
  };
  let owner: E2eAccount;
  let partner: E2eAccount;
  let stranger: E2eAccount;
  let partnerMemberId: string;
  let categoryId: string;

  const server = () => app.getHttpServer();
  /** Every call runs in the owner's household workspace, whoever makes it. */
  const as = (account: E2eAccount, req: request.Test, workspaceId = owner.workspaceId) =>
    req.set('Authorization', `Bearer ${account.token}`).set('x-workspace-id', workspaceId);
  const decode = <S extends Schema.Top>(schema: S, body: unknown) =>
    Schema.decodeUnknownSync(schema as never, { onExcessProperty: 'error' })(body) as S['Type'];

  async function wallet(
    account: E2eAccount,
    body: Record<string, unknown>,
    workspaceId = owner.workspaceId,
  ): Promise<string> {
    const res = await as(account, request(server()).post('/wallets'), workspaceId)
      .send({ currency: 'EUR', initialBalance: 0, ...body })
      .expect(201);
    return res.body.id;
  }

  async function goal(body: Record<string, unknown> = {}): Promise<GoalWithProgress> {
    const res = await as(owner, request(server()).post('/goals'))
      .send({ name: 'Lisbon flat', targetAmount: 1000, currency: 'EUR', ...body })
      .expect(201);
    return decode(GoalWithProgress, res.body);
  }

  const detail = async (id: string) =>
    decode(GoalDetail, (await as(owner, request(server()).get(`/goals/${id}`)).expect(200)).body);

  const spend = (walletId: string, amount: number) =>
    as(owner, request(server()).post('/statements/manual-expense'))
      .field('amount', String(amount))
      .field('currency', 'EUR')
      .field('merchant', 'ACME Store')
      .field('date', new Date().toISOString().slice(0, 10))
      .field('walletId', walletId)
      .field('categoryId', categoryId)
      .field('allowDuplicates', 'true')
      .expect(201);

  beforeAll(async () => {
    const moduleFixture: TestingModule = await e2eTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    dataSource = moduleFixture.get<DataSource>(DataSource);

    owner = await registerAccount(app, emails.owner, 'Member One');
    partner = await registerAccount(app, emails.partner, 'Member Two');
    stranger = await registerAccount(app, emails.stranger, 'Member Three');

    // Goals are edited by admins; a plain member has no toggle for them.
    const invite = await as(owner, request(server()).post(`/workspaces/${owner.workspaceId}/invitations`))
      .send({ email: partner.email, role: 'admin' })
      .expect(201);
    await request(server())
      .post(`/workspaces/invitations/${invite.body.invitation.token}/accept`)
      .set('Authorization', `Bearer ${partner.token}`)
      .expect(200);
    const [row] = await dataSource.query(
      'SELECT id FROM workspace_members WHERE workspace_id = $1 AND user_id = $2',
      [owner.workspaceId, partner.userId],
    );
    partnerMemberId = row.id;
    const categories = await as(owner, request(server()).get('/categories?type=expense')).expect(200);
    categoryId = categories.body[0].id;
  });

  afterAll(async () => {
    if (dataSource) {
      for (const email of Object.values(emails)) {
        await deleteUserByEmail(dataSource, email);
      }
    }
    await app.close();
  });

  it("counts the account's balance, takes no contributions, and gives them back on unlink", async () => {
    const savings = await wallet(owner, { name: 'ACME Savings', type: 'savings', initialBalance: 400 });
    const created = await goal();
    await as(owner, request(server()).post(`/goals/${created.id}/contributions`))
      .send({ amount: 50 })
      .expect(201);

    const linked = await as(owner, request(server()).put(`/goals/${created.id}`))
      .send({ walletId: savings })
      .expect(200);
    expect(decode(GoalWithProgress, linked.body)).toMatchObject({
      currentAmount: 400,
      account: { id: savings, name: 'ACME Savings', balance: 400, status: 'following' },
    });

    await spend(savings, 30);
    const following = await detail(created.id);
    expect(following.currentAmount).toBe(370);
    // The contribution is kept, only not counted.
    expect(following.contributions).toHaveLength(1);

    const refused = await as(owner, request(server()).post(`/goals/${created.id}/contributions`))
      .send({ amount: 10 })
      .expect(409);
    expect(refused.body.error.code).toBe('GOAL_FOLLOWS_ACCOUNT');

    const plan = decode(
      GoalPlanResponse,
      (await as(owner, request(server()).get(`/goals/${created.id}/plan`)).expect(200)).body,
    );
    // The plan speaks the workspace currency: compare shares, not amounts.
    expect(plan.saved / plan.target.declared).toBeCloseTo(0.37, 2);

    const unlinked = await as(owner, request(server()).put(`/goals/${created.id}`))
      .send({ walletId: null })
      .expect(200);
    expect(decode(GoalWithProgress, unlinked.body)).toMatchObject({ currentAmount: 50, account: null });
  });

  it('is reached once the balance reaches the target, and reads an overdraft as zero', async () => {
    const savings = await wallet(owner, { name: 'ACME Rainy Day', type: 'savings', initialBalance: 1200 });
    const reached = await goal({ walletId: savings });
    expect(reached).toMatchObject({ currentAmount: 1200, isReached: true, remaining: 0 });
    const plan = (await as(owner, request(server()).get(`/goals/${reached.id}/plan`)).expect(200)).body;
    expect(plan.status).toBe('reached');

    await spend(savings, 1500);
    const overdrawn = await detail(reached.id);
    expect(overdrawn).toMatchObject({ currentAmount: 0, percent: 0, isReached: false });
    expect(overdrawn.account?.balance).toBe(-300);
  });

  it("refuses another workspace's account and changes nothing", async () => {
    const theirs = await wallet(stranger, { name: 'Elsewhere' }, stranger.workspaceId);
    const created = await goal();

    const refused = await as(owner, request(server()).put(`/goals/${created.id}`))
      .send({ walletId: theirs })
      .expect(400);
    expect(refused.body.error.code).toBe('GOAL_ACCOUNT_UNAVAILABLE');
    await as(owner, request(server()).post('/goals'))
      .send({ name: 'Elsewhere goal', targetAmount: 10, walletId: theirs })
      .expect(400);

    const [row] = await dataSource.query('SELECT wallet_id FROM goals WHERE id = $1', [created.id]);
    expect(row.wallet_id).toBeNull();
  });

  it("refuses another member's own account but lets that member link it", async () => {
    const partners = await wallet(owner, { name: 'Member Two Pocket', ownerMemberId: partnerMemberId });
    const created = await goal();

    await as(owner, request(server()).put(`/goals/${created.id}`))
      .send({ walletId: partners })
      .expect(400);

    const own = await as(partner, request(server()).put(`/goals/${created.id}`))
      .send({ walletId: partners })
      .expect(200);
    expect(own.body.account).toMatchObject({ id: partners, status: 'following' });

    // Renaming the goal afterwards, sending the account it already follows, is not a new link.
    await as(owner, request(server()).put(`/goals/${created.id}`))
      .send({ name: 'Lisbon flat, together', walletId: partners })
      .expect(200);
  });

  it('falls back to contributions when the account is archived, then deleted', async () => {
    const savings = await wallet(owner, { name: 'ACME Old Savings', initialBalance: 900 });
    const created = await goal();
    await as(owner, request(server()).post(`/goals/${created.id}/contributions`))
      .send({ amount: 75 })
      .expect(201);
    await as(owner, request(server()).put(`/goals/${created.id}`)).send({ walletId: savings }).expect(200);
    expect((await detail(created.id)).currentAmount).toBe(900);

    await as(owner, request(server()).put(`/wallets/${savings}`)).send({ isActive: false }).expect(200);
    const archived = await detail(created.id);
    expect(archived).toMatchObject({ currentAmount: 75, account: { status: 'archived' } });
    // Contributions are taken again while the account is archived.
    await as(owner, request(server()).post(`/goals/${created.id}/contributions`))
      .send({ amount: 5 })
      .expect(201);
    // An archived account cannot be newly followed.
    const other = await goal();
    await as(owner, request(server()).put(`/goals/${other.id}`)).send({ walletId: savings }).expect(400);

    await as(owner, request(server()).delete(`/wallets/${savings}`)).expect(200);
    const deleted = await detail(created.id);
    expect(deleted).toMatchObject({ currentAmount: 80, account: null });
    const list = (await as(owner, request(server()).get('/goals')).expect(200)).body;
    expect(list.find((row: { id: string }) => row.id === created.id)).toMatchObject({ account: null });
  });

  it("keeps the followed account's name and balance from a key without wallet.view", async () => {
    const savings = await wallet(owner, { name: 'ACME Hidden Savings', initialBalance: 640 });
    const followed = await goal({ name: 'Key goal', walletId: savings });
    const key = async (scopes: string[]) =>
      (
        await as(owner, request(server()).post('/api-keys'))
          .send({ name: `Goals ${scopes.join(' ')}`, scopes })
          .expect(201)
      ).body.key as string;
    // api_key.manage belongs to the admin role.
    await dataSource.getRepository(User).update({ email: emails.owner }, { role: UserRole.ADMIN });
    // The MCP endpoint answers only once the workspace has the plugin on.
    await as(owner, request(server()).patch(`/workspaces/${owner.workspaceId}`))
      .send({ plugins: { mcp: true } })
      .expect(200);
    const goalsOnly = await key(['goal.view', 'goal.edit']);
    const withAccounts = await key(['goal.view', 'wallet.view']);
    const read = (apiKey: string, url: string) =>
      request(server()).get(url).set('x-api-key', apiKey).expect(200);
    const mcpGoals = async (apiKey: string) => {
      const res = await request(server())
        .post('/mcp')
        .set('x-api-key', apiKey)
        .set('Accept', 'application/json, text/event-stream')
        .send({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'list_goals', arguments: {} } })
        .expect(200);
      return JSON.parse(res.body.result.content[0].text) as Array<{ id: string; account: unknown }>;
    };

    const hiddenList = (await read(goalsOnly, '/goals')).body;
    const hiddenOne = (await read(goalsOnly, `/goals/${followed.id}`)).body;
    const hiddenMcp = await mcpGoals(goalsOnly);
    for (const row of [hiddenList.find((g: { id: string }) => g.id === followed.id), hiddenOne, hiddenMcp.find(g => g.id === followed.id)]) {
      // The goal's own progress stays; whose account it is, and its balance, do not.
      expect(row).toMatchObject({ account: null });
      expect(JSON.stringify(row)).not.toContain('ACME Hidden Savings');
    }
    expect(hiddenOne.currentAmount).toBe(640);
    // Nor can such a key make a goal follow an account it may not read.
    await request(server())
      .put(`/goals/${followed.id}`)
      .set('x-api-key', goalsOnly)
      .send({ walletId: savings })
      .expect(403);

    const shown = (await read(withAccounts, `/goals/${followed.id}`)).body;
    expect(shown.account).toMatchObject({ name: 'ACME Hidden Savings', balance: 640 });
    const shownMcp = await mcpGoals(withAccounts);
    expect(shownMcp.find(g => g.id === followed.id)?.account).toMatchObject({ name: 'ACME Hidden Savings' });
  });
});
