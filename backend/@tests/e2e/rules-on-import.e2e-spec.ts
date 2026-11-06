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
    });
    expect((await walletOf('CHARITY FUND')).wallet_id).toBe(giving);
  });
});
