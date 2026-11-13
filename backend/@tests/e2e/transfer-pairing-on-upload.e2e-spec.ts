vi.mock('franc', () => ({
  franc: () => 'und',
}));

import { getQueueToken } from '@nestjs/bullmq';
import { type INestApplication, ValidationPipe } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import type { Queue } from 'bullmq';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { STATEMENT_PARSING_QUEUE } from '../../src/modules/parsing/queue/statement-parsing.queue';
import {
  deleteUserByEmail,
  type E2eAccount,
  e2eTestingModule,
  registerAccount,
} from './helpers/e2e-app';

/** One OFX statement with a single row; a negative amount leaves the account. */
const ofx = (account: string, fitId: string, amount: string, payee: string, date: string) =>
  `OFXHEADER:100
DATA:OFXSGML
<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS>
<CURDEF>USD
<BANKACCTFROM><ACCTID>${account}</BANKACCTFROM>
<BANKTRANLIST><DTSTART>20261001<DTEND>20261231
<STMTTRN><TRNTYPE>${amount.startsWith('-') ? 'DEBIT' : 'CREDIT'}<DTPOSTED>${date}<TRNAMT>${amount}<FITID>${fitId}<NAME>${payee}</STMTTRN>
</BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`;

/** An MT940 statement with one credit whose balances do not add up: held for review. */
const unbalancedMt940 = (account: string, amount: string, date: string) => `:20:REF1
:25:${account}
:28C:1/1
:60F:C${date}USD0,00
:61:${date}C${amount.replace('.', ',')}NTRFNONREF//X1
:86:Transfer in
:62F:C${date}USD999,00
-`;

/**
 * Uploading a statement pairs the transfers its rows complete, the way the
 * import preview's commit always did: before this, an ordinary upload never ran
 * the matcher, so no transfer between the user's own accounts was ever found.
 * Deleting one leg releases the other, whichever way the row goes.
 */
describe('Transfer pairing on a statement upload (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let parsingQueue: Queue;
  const email = `transfer-upload-${Date.now()}@example.com`;
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
    parsingQueue = moduleFixture.get(getQueueToken(STATEMENT_PARSING_QUEUE));
    owner =await registerAccount(app, email, 'Transfer Owner');
  });

  afterAll(async () => {
    if (dataSource) {
      await deleteUserByEmail(dataSource, email);
    }
    await app.close();
  });

  let uploads = 0;
  /** Uploads a statement and waits for the parse; answers the statement id and status. */
  async function upload(file: string, walletId?: string, extension = 'ofx') {
    const request_ = as(request(server()).post('/statements'));
    if (walletId) {
      request_.field('walletId', walletId);
    }
    const uploaded = await request_
      .attach('file', Buffer.from(file, 'utf-8'), {
        filename: `transfer-${++uploads}.${extension}`,
        contentType: 'application/octet-stream',
      })
      .expect(201);
    return { id: uploaded.body.id as string, status: await settled(uploaded.body.id) };
  }

  /**
   * Waits for the parse job itself, not only the status: pairing runs after the
   * final status is saved, so a pair read on the status alone may not be there yet.
   */
  async function settled(statementId: string): Promise<string> {
    for (let attempt = 0; attempt < 60; attempt += 1) {
      const [row]: Array<{ status: string }> = await dataSource.query(
        'SELECT status FROM statements WHERE id = $1',
        [statementId],
      );
      const job = await parsingQueue.getJobState(statementId);
      if (
        ['completed', 'needs_review', 'error'].includes(row.status) &&
        ['completed', 'failed', 'unknown'].includes(job)
      ) {
        return row.status;
      }
      await new Promise(resolve => setTimeout(resolve, 250));
    }
    return 'timeout';
  }

  /** The one row a statement brought in. */
  async function rowOf(statementId: string): Promise<string> {
    const rows: Array<{ id: string }> = await dataSource.query(
      'SELECT id FROM transactions WHERE statement_id = $1',
      [statementId],
    );
    expect(rows).toHaveLength(1);
    return rows[0].id;
  }

  const pairOf = async (id: string): Promise<string | null> => {
    const [row]: Array<{ transfer_pair_id: string | null }> = await dataSource.query(
      'SELECT transfer_pair_id FROM transactions WHERE id = $1',
      [id],
    );
    return row.transfer_pair_id;
  };

  const wallet = async (name: string) =>
    (await as(request(server()).post('/wallets')).send({ name, currency: 'USD' }).expect(201)).body
      .id as string;

  /** Two accounts and a paired transfer of `amount` between them. */
  async function pairedTransfer(account: string, amount: string, date: string) {
    const from = await wallet(`From ${account}`);
    const to = await wallet(`To ${account}`);
    const out = await upload(ofx(`${account}1`, `${account}O`, `-${amount}`, 'Out', date), from);
    const into = await upload(ofx(`${account}2`, `${account}I`, amount, 'In', date), to);
    expect([out.status, into.status]).toEqual(['completed', 'completed']);
    const outRow = await rowOf(out.id);
    const intoRow = await rowOf(into.id);
    return { out, into, outRow, intoRow };
  }

  it('pairs a transfer between two accounts once the second statement is uploaded', async () => {
    const checking = await wallet('Everyday card');
    const savings = await wallet('Savings');

    const out = await upload(
      ofx('111122223333', 'T1', '-500.00', 'Online transfer', '20261002'),
      checking,
    );
    const outRow = await rowOf(out.id);
    expect(await pairOf(outRow)).toBeNull();

    const into = await upload(
      ofx('444455556666', 'T2', '500.00', 'Transfer from Everyday card', '20261003'),
      savings,
    );
    const pairId = await pairOf(await rowOf(into.id));
    expect(pairId).not.toBeNull();
    expect(await pairOf(outRow)).toBe(pairId);

    const [statement]: Array<{ details: { transferPairs?: unknown } }> = await dataSource.query(
      'SELECT parsing_details AS details FROM statements WHERE id = $1',
      [into.id],
    );
    expect(statement.details.transferPairs).toEqual({ found: 1, paired: 1 });
  });

  it('leaves money in and out of one account alone, also without an account picked', async () => {
    // Two statements of the same account and no account picked: the matcher
    // tells accounts apart by the account number stored with each statement.
    const charge = await upload(ofx('777788889999', 'S1', '-500.00', 'Store charge', '20261010'));
    const refund = await upload(ofx('777788889999', 'S2', '500.00', 'Store refund', '20261011'));
    expect(await pairOf(await rowOf(charge.id))).toBeNull();
    expect(await pairOf(await rowOf(refund.id))).toBeNull();
  });

  it('pairs a statement held for review too: its rows count in the figures', async () => {
    const from = await wallet('Held from');
    const to = await wallet('Held to');
    const out = await upload(ofx('31310001', 'H1', '-300.00', 'Out', '20261020'), from);
    const held = await upload(unbalancedMt940('31310002', '300.00', '261020'), to, 'sta');
    expect(held.status).toBe('needs_review');
    const pairId = await pairOf(await rowOf(held.id));
    expect(pairId).not.toBeNull();
    expect(await pairOf(await rowOf(out.id))).toBe(pairId);
  });

  it('leaves the rows of a statement that failed alone', async () => {
    const from = await wallet('Failed from');
    const to = await wallet('Failed to');
    const out = await upload(ofx('42420001', 'X1', '-410.00', 'Out', '20261025'), from);
    const failed = await upload(ofx('42420002', 'X2', '410.00', 'In', '20261026'), to);
    await dataSource.query(`UPDATE transactions SET transfer_pair_id = NULL WHERE statement_id IN ($1, $2)`, [
      out.id,
      failed.id,
    ]);
    await dataSource.query(`UPDATE statements SET status = 'error' WHERE id = $1`, [failed.id]);
    await as(request(server()).post('/transactions/transfers/detect')).send({}).expect(200);
    expect(await pairOf(await rowOf(out.id))).toBeNull();
  });

  it('pairs the transfer again after its statement is reprocessed', async () => {
    const { into, outRow } = await pairedTransfer('4242', '610.00', '20261105');
    await as(request(server()).post(`/statements/${into.id}/reprocess`)).expect(201);
    expect(await settled(into.id)).toBe('completed');

    const newRow = await rowOf(into.id);
    const pairId = await pairOf(newRow);
    expect(pairId).not.toBeNull();
    expect(await pairOf(outRow)).toBe(pairId);
  });

  it('releases the other leg when one is deleted, and an undo brings the row back unpaired', async () => {
    const { outRow, intoRow } = await pairedTransfer('5353', '720.00', '20261110');
    await as(request(server()).delete(`/transactions/${intoRow}`)).expect(204);
    expect(await pairOf(outRow)).toBeNull();

    // Undo is for admins; the event is the deletion just made.
    await dataSource.query(`UPDATE users SET role = 'admin' WHERE id = $1`, [owner.userId]);
    const [event]: Array<{ id: string }> = await dataSource.query(
      `SELECT id FROM audit_events WHERE entity_id = $1 AND action = 'delete'`,
      [intoRow],
    );
    await as(request(server()).post(`/audit-events/${event.id}/rollback`)).expect(201);
    expect(await pairOf(intoRow)).toBeNull();
    expect(await pairOf(outRow)).toBeNull();
  });
});
