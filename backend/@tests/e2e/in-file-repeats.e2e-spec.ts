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
import { occurrenceFingerprint } from '../../src/common/utils/fingerprint.util';
import { STATEMENT_PARSING_QUEUE } from '../../src/modules/parsing/queue/statement-parsing.queue';
import {
  deleteUserByEmail,
  type E2eAccount,
  e2eTestingModule,
  registerAccount,
} from './helpers/e2e-app';

const COFFEE = { payee: 'ACME Coffee', amount: '-3.50', date: '20260310' };

/** One OFX file with two identical coffee payments; `end` only changes the file's bytes. */
const twoCoffees = (end: string) => `OFXHEADER:100
DATA:OFXSGML
<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS>
<CURDEF>EUR
<BANKACCTFROM><ACCTID>REPEATS1</BANKACCTFROM>
<BANKTRANLIST><DTSTART>20260301<DTEND>${end}
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>${COFFEE.date}<TRNAMT>${COFFEE.amount}<FITID>C1<NAME>${COFFEE.payee}</STMTTRN>
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>${COFFEE.date}<TRNAMT>${COFFEE.amount}<FITID>C2<NAME>${COFFEE.payee}</STMTTRN>
</BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`;

type Row = { id: string; is_duplicate: boolean; duplicate_of_id: string | null; fingerprint: string | null };

/**
 * Two identical rows of one file are two payments: both count, and uploading
 * the file again still finds both. Any row Review shows as a duplicate can be
 * kept, with or without an original.
 */
describe('Identical rows in one statement (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let parsingQueue: Queue;
  const email = `in-file-repeats-${Date.now()}@example.com`;
  let owner: E2eAccount;

  const as = (req: request.Test) =>
    req.set('Authorization', `Bearer ${owner.token}`).set('x-workspace-id', owner.workspaceId);
  const server = () => app.getHttpServer();

  beforeAll(async () => {
    const moduleFixture: TestingModule = await e2eTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    dataSource = moduleFixture.get<DataSource>(DataSource);
    parsingQueue = moduleFixture.get(getQueueToken(STATEMENT_PARSING_QUEUE));
    owner = await registerAccount(app, email, 'Repeats Owner');
  });

  afterAll(async () => {
    if (dataSource) {
      await deleteUserByEmail(dataSource, email);
    }
    await app.close();
  });

  let uploads = 0;
  async function upload(file: string): Promise<Row[]> {
    const uploaded = await as(request(server()).post('/statements'))
      .attach('file', Buffer.from(file, 'utf-8'), {
        filename: `repeats-${++uploads}.ofx`,
        contentType: 'application/octet-stream',
      })
      .expect(201);
    const id = uploaded.body.id as string;
    for (let attempt = 0; attempt < 60; attempt += 1) {
      const [row]: Array<{ status: string }> = await dataSource.query(
        'SELECT status FROM statements WHERE id = $1',
        [id],
      );
      const job = await parsingQueue.getJobState(id);
      if (
        ['completed', 'needs_review', 'error'].includes(row.status) &&
        ['completed', 'failed', 'unknown'].includes(job)
      ) {
        break;
      }
      await new Promise(resolve => setTimeout(resolve, 250));
    }
    return dataSource.query(
      `SELECT id, is_duplicate, duplicate_of_id, fingerprint FROM transactions
       WHERE statement_id = $1 ORDER BY created_at, id`,
      [id],
    );
  }

  const keep = (id: string) =>
    as(request(server()).post(`/review-inbox/duplicates/${id}/resolve`)).send({ decision: 'keep' });

  let originals: Row[];

  it('counts both identical payments of one file', async () => {
    originals = await upload(twoCoffees('20260331'));

    expect(originals).toHaveLength(2);
    expect(originals.map(row => row.is_duplicate)).toEqual([false, false]);
    expect(originals[0].fingerprint).not.toBe(originals[1].fingerprint);
  });

  it('flags both again when the same rows are uploaded once more, each against its own original', async () => {
    const again = await upload(twoCoffees('20260330'));

    expect(again.map(row => row.is_duplicate)).toEqual([true, true]);
    expect(again.map(row => row.duplicate_of_id).sort()).toEqual(
      originals.map(row => row.id).sort(),
    );

    // Keeping one beside its original must not trip the one-fingerprint-per-counted-row index.
    await keep(again[0].id).expect(200);
    const [kept]: Row[] = await dataSource.query(
      'SELECT id, is_duplicate, duplicate_of_id, fingerprint FROM transactions WHERE id = $1',
      [again[0].id],
    );
    expect(kept).toMatchObject({ is_duplicate: false, duplicate_of_id: null });
    expect(kept.fingerprint).not.toBeNull();
    expect(kept.fingerprint).not.toBe(again[0].fingerprint);
  });

  it('a repeat flagged by an older import, once kept, is still found by the next upload', async () => {
    const counted = async () =>
      Number(
        (
          await dataSource.query(
            `SELECT count(*) AS n FROM transactions
             WHERE workspace_id = $1 AND counterparty_name = $2 AND is_duplicate = false
               AND transaction_date = '2026-04-10'`,
            [owner.workspaceId, COFFEE.payee],
          )
        )[0].n,
      );
    const rows = await upload(twoCoffees('20260430').replace(/20260310/g, '20260410'));
    // The row holding the base fingerprint, and its numbered twin (row order is not fixed).
    const [first, second] =
      occurrenceFingerprint(rows[0].fingerprint as string, 2) === rows[1].fingerprint
        ? [rows[0], rows[1]]
        : [rows[1], rows[0]];
    // What the old import left: the second coffee with the first one's fingerprint, no original.
    await dataSource.query(
      'UPDATE transactions SET is_duplicate = true, duplicate_of_id = NULL, fingerprint = $2 WHERE id = $1',
      [second.id, first.fingerprint],
    );
    expect(await counted()).toBe(1);

    await keep(second.id).expect(200);
    expect(await counted()).toBe(2);

    await upload(twoCoffees('20260429').replace(/20260310/g, '20260410'));
    expect(await counted()).toBe(2);
  });

  it('two Keeps at once on rows sharing a fingerprint both succeed', async () => {
    const rows = await upload(twoCoffees('20260531').replace(/20260310/g, '20260510'));
    await dataSource.query(
      'UPDATE transactions SET is_duplicate = true, duplicate_of_id = NULL, fingerprint = $2 WHERE id = ANY($1)',
      [rows.map(row => row.id), rows[0].fingerprint],
    );

    const answers = await Promise.all(rows.map(row => keep(row.id)));

    expect(answers.map(answer => answer.status)).toEqual([200, 200]);
    const kept: Row[] = await dataSource.query(
      'SELECT id, is_duplicate, duplicate_of_id, fingerprint FROM transactions WHERE id = ANY($1)',
      [rows.map(row => row.id)],
    );
    expect(new Set(kept.map(row => row.fingerprint)).size).toBe(2);
  });

  it('keeps a row flagged without an original, as older imports left them', async () => {
    await dataSource.query(
      'UPDATE transactions SET is_duplicate = true, duplicate_of_id = NULL, fingerprint = NULL WHERE id = $1',
      [originals[1].id],
    );

    await keep(originals[1].id).expect(200);

    const [row]: Row[] = await dataSource.query(
      'SELECT id, is_duplicate, duplicate_of_id, fingerprint FROM transactions WHERE id = $1',
      [originals[1].id],
    );
    expect(row.is_duplicate).toBe(false);
  });
});
