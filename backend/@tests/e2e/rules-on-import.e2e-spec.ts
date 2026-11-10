vi.mock('franc', () => ({
  franc: () => 'und',
}));

import { type INestApplication, ValidationPipe } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import {
  deleteUserByEmail,
  type E2eAccount,
  e2eTestingModule,
  registerAccount,
} from './helpers/e2e-app';

const SHOP = 'ACME STORE';
const OFX = `OFXHEADER:100
DATA:OFXSGML
<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS>
<CURDEF>USD
<BANKACCTFROM><ACCTID>444555666</BANKACCTFROM>
<BANKTRANLIST><DTSTART>20260901<DTEND>20260930
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20260903<TRNAMT>-25.00<FITID>R1<NAME>${SHOP}</STMTTRN>
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20260904<TRNAMT>-8.00<FITID>R2<NAME>CORNER BAKERY</STMTTRN>
</BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`;

/** A rule the user wrote files the rows of the next statement they import. */
describe('Categorization rules on a statement import (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  const email = `rules-import-${Date.now()}@example.com`;
  const otherEmail = `rules-import-other-${Date.now()}@example.com`;
  let owner: E2eAccount;

  const as = (req: request.Test) =>
    req.set('Authorization', `Bearer ${owner.token}`).set('x-workspace-id', owner.workspaceId);
  const server = () => app.getHttpServer();

  beforeAll(async () => {
    const moduleFixture: TestingModule = await e2eTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    dataSource = moduleFixture.get<DataSource>(DataSource);
    owner = await registerAccount(app, email, 'Rules Owner');
  });

  afterAll(async () => {
    if (dataSource) {
      await deleteUserByEmail(dataSource, email);
      await deleteUserByEmail(dataSource, otherEmail);
    }
    await app.close();
  });

  const ofx = (account: string, fitId: string, payee: string) => `OFXHEADER:100
DATA:OFXSGML
<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS>
<CURDEF>USD
<BANKACCTFROM><ACCTID>${account}</BANKACCTFROM>
<BANKTRANLIST><DTSTART>20260901<DTEND>20260930
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20260905<TRNAMT>-12.00<FITID>${fitId}<NAME>${payee}</STMTTRN>
</BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`;

  /** Uploads a statement, waits for the parse and answers its rows. */
  let uploads = 0;
  async function importRows(file: string, walletId?: string) {
    const upload = as(request(server()).post('/statements'));
    if (walletId) {
      upload.field('walletId', walletId);
    }
    const uploaded = await upload
      .attach('file', Buffer.from(file, 'utf-8'), {
        // A second file of the same name and size within minutes is taken for a resend.
        filename: `export-${++uploads}.ofx`,
        contentType: 'application/octet-stream',
      })
      .expect(201);
    let statement = uploaded.body;
    const settled = ['completed', 'parsed', 'validated', 'error'];
    for (let attempt = 0; attempt < 40 && !settled.includes(statement.status); attempt += 1) {
      await new Promise(resolve => setTimeout(resolve, 500));
      statement = (await as(request(server()).get(`/statements/${uploaded.body.id}`)).expect(200))
        .body;
    }
    expect(statement.status).not.toBe('error');
    const rows = await as(
      request(server()).get(`/transactions?statementId=${uploaded.body.id}`),
    ).expect(200);
    return rows.body.data as Array<{
      counterpartyName: string;
      categoryId: string | null;
      categorySource: string | null;
    }>;
  }

  it('imports the statement and files the matching row under the rule', async () => {
    const categories = await as(request(server()).get('/categories?type=expense')).expect(200);
    const categoryId: string = categories.body[1].id;
    const rule = await as(request(server()).post('/categorization-rules'))
      .send({
        name: 'ACME is a shop',
        conditions: [{ field: 'counterparty_name', operator: 'contains', value: SHOP.toLowerCase() }],
        result: { categoryId },
      })
      .expect(201);

    const rows = await importRows(OFX);
    expect(rows).toHaveLength(2);
    const filed = rows.find(row => row.counterpartyName === SHOP);
    expect(filed?.categoryId).toBe(categoryId);
    expect(filed?.categorySource).toBe('rule');

    const stored = await as(request(server()).get(`/categorization-rules/${rule.body.id}`)).expect(200);
    expect(stored.body.matchCount).toBe(1);
  });

  it("matches a rule on the owner of the statement's account", async () => {
    const [{ id: memberId }]: Array<{ id: string }> = await dataSource.query(
      'SELECT id FROM workspace_members WHERE workspace_id = $1 AND user_id = $2',
      [owner.workspaceId, owner.userId],
    );
    const categories = await as(request(server()).get('/categories?type=expense')).expect(200);
    const categoryId: string = categories.body[2].id;
    const mine = await as(request(server()).post('/wallets'))
      .send({ name: 'Member One card', currency: 'USD', ownerMemberId: memberId })
      .expect(201);
    const shared = await as(request(server()).post('/wallets'))
      .send({ name: 'Household card', currency: 'USD' })
      .expect(201);
    await as(request(server()).post('/categorization-rules'))
      .send({
        name: "Member One's own spending",
        conditions: [{ field: 'owner', operator: 'equals', value: memberId }],
        result: { categoryId },
      })
      .expect(201);

    const [own] = await importRows(ofx('777000111', 'O1', 'GARDEN CENTRE'), mine.body.id);
    const [household] = await importRows(ofx('777000222', 'O2', 'GARDEN CENTRE'), shared.body.id);

    expect(own.categoryId).toBe(categoryId);
    expect(own.categorySource).toBe('rule');
    expect(household.categorySource).not.toBe('rule');
  });

  it("puts a row in the account a rule names, over its statement's, and keeps it there", async () => {
    const wallet = (name: string) =>
      as(request(server()).post('/wallets')).send({ name, currency: 'USD' }).expect(201);
    const bank = (await wallet('Everyday account')).body.id as string;
    const giving = (await wallet('Giving account')).body.id as string;
    const rule = await as(request(server()).post('/categorization-rules'))
      .send({
        name: 'Donations go to the giving account',
        conditions: [{ field: 'counterparty_name', operator: 'contains', value: 'charity fund' }],
        result: { walletId: giving },
      })
      .expect(201);
    const walletOf = async (name: string) => {
      const [row]: Array<{ wallet_id: string; statement_id: string }> = await dataSource.query(
        'SELECT wallet_id, statement_id FROM transactions WHERE workspace_id = $1 AND counterparty_name = $2',
        [owner.workspaceId, name],
      );
      return row;
    };

    await importRows(ofx('888000111', 'W1', 'CHARITY FUND'), bank);
    await importRows(ofx('888000111', 'W2', 'HARDWARE SHOP'), bank);

    // The rule beats the statement's account; the row beside it stays with the statement.
    const donation = await walletOf('CHARITY FUND');
    expect(donation.wallet_id).toBe(giving);
    expect((await walletOf('HARDWARE SHOP')).wallet_id).toBe(bank);

    // Attaching the statement again does not take the row back.
    await as(request(server()).post(`/wallets/${bank}/statements`))
      .send({ statementIds: [donation.statement_id] })
      .expect(201);
    expect((await walletOf('CHARITY FUND')).wallet_id).toBe(giving);

    // Put back by hand, the row is moved again by "apply to existing rows", and the answer says so.
    await dataSource.query(
      'UPDATE transactions SET wallet_id = $1 WHERE workspace_id = $2 AND counterparty_name = $3',
      [bank, owner.workspaceId, 'CHARITY FUND'],
    );
    const preview = await as(request(server()).post('/categorization-rules/test'))
      .send({ conditions: rule.body.conditions, ruleId: rule.body.id, walletId: giving })
      .expect(200);
    expect(preview.body.movable).toBe(1);
    const applied = await as(
      request(server()).post(`/categorization-rules/${rule.body.id}/apply`),
    ).expect(200);
    expect(applied.body).toEqual({
      applied: 0,
      skippedManual: 0,
      tagged: 0,
      moved: 1,
      commented: 0,
      renamed: 0,
      excluded: 0,
    });
    expect((await walletOf('CHARITY FUND')).wallet_id).toBe(giving);
  });

  it('lets a rule below read the category and tags the rules above set on the same import', async () => {
    const categories = await as(request(server()).get('/categories?type=expense')).expect(200);
    const categoryId: string = categories.body[3].id;
    const pets = await as(request(server()).post('/tags')).send({ name: 'Pets' }).expect(201);
    const checked = await as(request(server()).post('/tags')).send({ name: 'Checked' }).expect(201);
    // Written first, so ranked below the rule that files the row.
    await as(request(server()).post('/categorization-rules'))
      .send({
        name: 'Pet spending is checked',
        conditions: [
          { field: 'category', operator: 'equals', value: categoryId },
          {
            matchMode: 'any',
            conditions: [
              { field: 'tags', operator: 'equals', value: pets.body.id },
              { field: 'amount', operator: 'greater_than', value: 1000 },
            ],
          },
        ],
        result: { tagIds: [checked.body.id] },
      })
      .expect(201);
    await as(request(server()).post('/categorization-rules'))
      .send({
        name: 'Pet shop',
        conditions: [{ field: 'counterparty_name', operator: 'contains', value: 'pet shop' }],
        result: { categoryId, tagIds: [pets.body.id] },
      })
      .expect(201);
    const blank = await as(request(server()).post('/categorization-rules'))
      .send({
        name: 'Blank stays blank',
        conditions: [
          { field: 'counterparty_name', operator: 'contains', value: 'pet shop' },
          { field: 'category', operator: 'is_empty', value: '' },
        ],
        result: { comment: 'Not filed' },
      })
      .expect(201);
    // Moved to the bottom: by then the pet shop rule has filed the row.
    const rules = await as(request(server()).get('/categorization-rules')).expect(200);
    const order = rules.body.data
      .map((rule: { id: string }) => rule.id)
      .filter((id: string) => id !== blank.body.id);
    await as(request(server()).put('/categorization-rules/order'))
      .send({ ids: [...order, blank.body.id] })
      .expect(200);

    await importRows(ofx('555000111', 'P1', 'PET SHOP'));

    const [row]: Array<{ id: string; category_id: string; comments: string | null }> =
      await dataSource.query(
        'SELECT id, category_id, comments FROM transactions WHERE workspace_id = $1 AND counterparty_name = $2',
        [owner.workspaceId, 'PET SHOP'],
      );
    expect(row.category_id).toBe(categoryId);
    expect(row.comments).toBeNull();
    const tags: Array<{ tag_id: string }> = await dataSource.query(
      'SELECT tag_id FROM transaction_tags WHERE transaction_id = $1',
      [row.id],
    );
    expect(tags.map(tag => tag.tag_id).sort()).toEqual([pets.body.id, checked.body.id].sort());
  });

  it('keeps a row a "category is empty" rule filed when the rules re-run on it', async () => {
    const categories = await as(request(server()).get('/categories?type=expense')).expect(200);
    const categoryId: string = categories.body[4].id;
    await as(request(server()).post('/categorization-rules'))
      .send({
        name: 'Fill blank',
        conditions: [
          { field: 'counterparty_name', operator: 'contains', value: 'flip shop' },
          { field: 'category', operator: 'is_empty', value: '' },
        ],
        result: { categoryId },
      })
      .expect(201);
    const [imported] = (await importRows(ofx('555000222', 'F1', 'FLIP SHOP'))) as Array<{
      id: string;
      categoryId: string | null;
    }>;
    expect(imported.categoryId).toBe(categoryId);

    const bulk = await as(request(server()).post('/classification/bulk'))
      .send({ transactionIds: [imported.id] })
      .expect(200);
    expect(bulk.body.successful).toBe(1);
    const [row]: Array<{ category_id: string; category_source: string }> = await dataSource.query(
      'SELECT category_id, category_source FROM transactions WHERE workspace_id = $1 AND id = $2',
      [owner.workspaceId, imported.id],
    );
    expect(row).toEqual({ category_id: categoryId, category_source: 'rule' });
  });

  it("refuses a condition naming another workspace's category, tag or payee", async () => {
    const other = await registerAccount(app, otherEmail, 'Member Two');
    const theirs = (req: request.Test) =>
      req.set('Authorization', `Bearer ${other.token}`).set('x-workspace-id', other.workspaceId);
    const [category] = (await theirs(request(server()).get('/categories?type=expense')).expect(200))
      .body;
    const tag = await theirs(request(server()).post('/tags')).send({ name: 'Theirs' }).expect(201);
    const [payee]: Array<{ id: string }> = await dataSource.query(
      'INSERT INTO payees (workspace_id, name) VALUES ($1, $2) RETURNING id',
      [other.workspaceId, 'ACME Store'],
    );
    const mine = await as(request(server()).post('/categorization-rules'))
      .send({
        name: 'Mine',
        conditions: [{ field: 'counterparty_name', operator: 'contains', value: 'acme' }],
        result: { comment: 'Seen' },
      })
      .expect(201);

    for (const condition of [
      { field: 'category', operator: 'equals', value: category.id },
      { field: 'tags', operator: 'not_equals', value: [tag.body.id] },
      { field: 'payee', operator: 'equals', value: payee.id },
    ]) {
      const nested = [{ matchMode: 'any', conditions: [condition] }];
      await as(request(server()).post('/categorization-rules'))
        .send({ name: 'Theirs', conditions: nested, result: { comment: 'x' } })
        .expect(404);
      await as(request(server()).put(`/categorization-rules/${mine.body.id}`))
        .send({ conditions: [condition] })
        .expect(404);
    }
    const stored = await as(request(server()).get(`/categorization-rules/${mine.body.id}`)).expect(200);
    expect(stored.body.conditions).toEqual([
      { field: 'counterparty_name', operator: 'contains', value: 'acme' },
    ]);
  });
});
