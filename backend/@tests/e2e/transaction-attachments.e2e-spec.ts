vi.mock('franc', () => ({
  franc: () => 'und',
}));

// Every file this spec writes, and every file the sweep below may move, lives in
// a directory of its own: never the uploads volume of a running instance. Set
// before anything is imported, since the upload helpers read it at import time.
const uploads = vi.hoisted(() => {
  const os = require('node:os');
  const fsSync = require('node:fs');
  const pathSync = require('node:path');
  const previous = process.env.UPLOADS_DIR;
  const dir = fsSync.mkdtempSync(pathSync.join(os.tmpdir(), 'seneca-att-e2e-'));
  process.env.UPLOADS_DIR = dir;
  return { dir: dir as string, previous: previous as string | undefined };
});

import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { type INestApplication, ValidationPipe } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { resolveUploadsDir } from '../../src/common/utils/uploads.util';
import { BackupArchiveService } from '../../src/modules/backups/backup-archive.service';
import { BackupDataService } from '../../src/modules/backups/backup-data.service';
import { TransactionAttachment } from '../../src/entities/transaction-attachment.entity';
import { TransactionAttachmentSweeperService } from '../../src/modules/transactions/services/transaction-attachment-sweeper.service';
import {
  deleteUserByEmail,
  type E2eAccount,
  e2eTestingModule,
  registerAccount,
} from './helpers/e2e-app';

/** A 1×1 PNG: real signature bytes, so the sniffing accepts it. */
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);
const PDF = Buffer.from('%PDF-1.4 ACME Store invoice');
/** Fails the spec unless the uploads dir is this spec's own temporary one. */
function ownUploadsDir(): string {
  const dir = path.resolve(resolveUploadsDir());
  if (dir !== path.resolve(uploads.dir) || !dir.startsWith(path.join(os.tmpdir(), 'seneca-att-e2e-'))) {
    throw new Error(`Refusing to run: uploads dir ${dir} is not this spec's temporary directory`);
  }
  return dir;
}
const storedPath = (name: string) =>
  path.join(resolveUploadsDir(), 'transaction-attachments', path.basename(name));

/** Files pinned to a row: who may read and change them, what is refused, where the bytes go. */
describe('Transaction attachments (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  const stamp = Date.now();
  const emails = {
    owner: `att-owner-${stamp}@example.com`,
    partner: `att-partner-${stamp}@example.com`,
    viewer: `att-viewer-${stamp}@example.com`,
    stranger: `att-stranger-${stamp}@example.com`,
  };
  const accounts = {} as Record<keyof typeof emails, E2eAccount>;
  const restoredWorkspaceIds: string[] = [];
  let txId: string;
  let privateTxId: string;

  const server = () => app.getHttpServer();
  /** As `who`, in the owner's workspace unless another is named. */
  const as = (who: keyof typeof emails, req: request.Test, workspaceId?: string) =>
    req
      .set('Authorization', `Bearer ${accounts[who].token}`)
      .set('x-workspace-id', workspaceId ?? accounts.owner.workspaceId);
  const upload = (
    who: keyof typeof emails,
    transactionId: string,
    bytes: Buffer,
    filename: string,
    contentType: string,
  ) =>
    as(who, request(server()).post(`/transactions/${transactionId}/attachments`)).attach(
      'file',
      bytes,
      { filename, contentType },
    );
  const download = (who: keyof typeof emails, id: string, workspaceId?: string) =>
    as(who, request(server()).get(`/transactions/attachments/${id}/download`), workspaceId)
      .buffer(true)
      .parse((res, done) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => done(null, Buffer.concat(chunks)));
      });

  /** A manual expense in `who`'s own workspace (the owner's by default): its row and statement. */
  async function bookRow(
    merchant: string,
    who: keyof typeof emails = 'owner',
  ): Promise<{ id: string; statementId: string }> {
    const ws = accounts[who].workspaceId;
    const categories = await as(who, request(server()).get('/categories?type=expense'), ws);
    const statement = await as(who, request(server()).post('/statements/manual-expense'), ws)
      .field('amount', '42')
      .field('currency', 'EUR')
      .field('merchant', merchant)
      .field('categoryId', categories.body[0].id)
      .field('date', '2026-10-14')
      .expect(201);
    const listed = await as(
      who,
      request(server()).get(`/transactions?statementId=${statement.body.id}`),
      ws,
    ).expect(200);
    return { id: listed.body.data[0].id, statementId: statement.body.id };
  }
  const bookExpense = async (merchant: string) => (await bookRow(merchant)).id;
  const memberId = async (who: keyof typeof emails): Promise<string> => {
    const [row] = await dataSource.query(
      'SELECT id FROM workspace_members WHERE workspace_id = $1 AND user_id = $2',
      [accounts.owner.workspaceId, accounts[who].userId],
    );
    return row.id;
  };
  const storedNameOf = async (attachmentId: string): Promise<string> => {
    const [row] = await dataSource.query(
      'SELECT stored_file_name FROM transaction_attachments WHERE id = $1',
      [attachmentId],
    );
    return row.stored_file_name;
  };

  async function invite(who: 'partner' | 'viewer', role: string, canEdit: boolean) {
    const sent = await as(
      'owner',
      request(server()).post(`/workspaces/${accounts.owner.workspaceId}/invitations`),
    )
      .send({ email: accounts[who].email, role, permissions: { canEditStatements: canEdit } })
      .expect(201);
    await request(server())
      .post(`/workspaces/invitations/${sent.body.invitation.token}/accept`)
      .set('Authorization', `Bearer ${accounts[who].token}`)
      .expect(200);
  }

  beforeAll(async () => {
    ownUploadsDir();
    const moduleFixture: TestingModule = await e2eTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    dataSource = moduleFixture.get(DataSource);

    for (const [who, email] of Object.entries(emails)) {
      accounts[who as keyof typeof emails] = await registerAccount(app, email, `Member ${who}`);
    }
    await invite('partner', 'member', true);
    await invite('viewer', 'viewer', false);

    txId = await bookExpense('ACME Store - Wireless Buds');
    privateTxId = await bookExpense('Example Jeweller - Ring');
    const [owner] = await dataSource.query(
      'SELECT id FROM workspace_members WHERE workspace_id = $1 AND user_id = $2',
      [accounts.owner.workspaceId, accounts.owner.userId],
    );
    // Owned first: only a row with an owner can be made private.
    await as('owner', request(server()).put(`/transactions/${privateTxId}`))
      .send({ ownerMemberId: owner.id })
      .expect(200);
    await as('owner', request(server()).put(`/transactions/${privateTxId}`))
      .send({ isPrivate: true })
      .expect(200);
  }, 180_000);

  afterAll(async () => {
    if (dataSource) {
      for (const id of restoredWorkspaceIds) {
        await dataSource.query('DELETE FROM workspaces WHERE id = $1', [id]).catch(() => undefined);
      }
      for (const email of Object.values(emails)) await deleteUserByEmail(dataSource, email);
    }
    await app?.close();
    if (uploads.previous === undefined) delete process.env.UPLOADS_DIR;
    else process.env.UPLOADS_DIR = uploads.previous;
    fs.rmSync(uploads.dir, { recursive: true, force: true });
  });

  it('uploads, lists, downloads as a safe attachment and deletes a file with its bytes', async () => {
    const uploaded = await upload('owner', txId, PNG, 'receipt.png', 'image/png').expect(201);
    expect(uploaded.body).toMatchObject({
      transactionId: txId,
      fileName: 'receipt.png',
      mimeType: 'image/png',
      fileSize: String(PNG.length),
    });
    expect(uploaded.body).not.toHaveProperty('storedFileName');

    const listed = await as(
      'partner',
      request(server()).get(`/transactions/${txId}/attachments`),
    ).expect(200);
    expect(listed.body.map((row: { id: string }) => row.id)).toEqual([uploaded.body.id]);

    const file = await download('viewer', uploaded.body.id).expect(200);
    expect(file.body).toEqual(PNG);
    expect(file.headers['content-type']).toBe('image/png');
    expect(file.headers['content-disposition']).toMatch(/^attachment; filename="receipt\.png"/);
    expect(file.headers['x-content-type-options']).toBe('nosniff');
    expect(file.headers['content-security-policy']).toBe("default-src 'none'; sandbox");
    expect(file.headers['cache-control']).toBe('private, no-store');

    const [{ stored_file_name: stored }] = await dataSource.query(
      'SELECT stored_file_name FROM transaction_attachments WHERE id = $1',
      [uploaded.body.id],
    );
    expect(fs.existsSync(storedPath(stored))).toBe(true);

    await as(
      'partner',
      request(server()).delete(`/transactions/attachments/${uploaded.body.id}`),
    ).expect(200);
    expect(fs.existsSync(storedPath(stored))).toBe(false);
    await download('owner', uploaded.body.id).expect(404);
    await as(
      'owner',
      request(server()).delete(`/transactions/attachments/${uploaded.body.id}`),
    ).expect(404);
  });

  it("answers 404 for another workspace's row and file, and changes nothing there", async () => {
    const mine = await upload('owner', txId, PDF, 'invoice.pdf', 'application/pdf').expect(201);
    const theirs = accounts.stranger.workspaceId;

    await as('stranger', request(server()).get(`/transactions/${txId}/attachments`), theirs).expect(
      404,
    );
    await as('stranger', request(server()).post(`/transactions/${txId}/attachments`), theirs)
      .attach('file', PDF, { filename: 'x.pdf', contentType: 'application/pdf' })
      .expect(404);
    await download('stranger', mine.body.id, theirs).expect(404);
    await as(
      'stranger',
      request(server()).delete(`/transactions/attachments/${mine.body.id}`),
      theirs,
    ).expect(404);
    // The owner's workspace named in the header: not a member, so refused before anything.
    const refused = await download('stranger', mine.body.id);
    expect([403, 404]).toContain(refused.status);

    await download('owner', mine.body.id).expect(200);
    await as('owner', request(server()).delete(`/transactions/attachments/${mine.body.id}`)).expect(
      200,
    );
  });

  it('lets a viewer read but not add or remove', async () => {
    const mine = await upload('owner', txId, PDF, 'contract.pdf', 'application/pdf').expect(201);

    await as('viewer', request(server()).get(`/transactions/${txId}/attachments`)).expect(200);
    await upload('viewer', txId, PDF, 'mine.pdf', 'application/pdf').expect(403);
    await as(
      'viewer',
      request(server()).delete(`/transactions/attachments/${mine.body.id}`),
    ).expect(403);

    await as('owner', request(server()).delete(`/transactions/attachments/${mine.body.id}`)).expect(
      200,
    );
  });

  it("keeps the files of another member's private row out of reach", async () => {
    const mine = await upload('owner', privateTxId, PNG, 'ring.png', 'image/png').expect(201);

    await as('partner', request(server()).get(`/transactions/${privateTxId}/attachments`)).expect(
      404,
    );
    await upload('partner', privateTxId, PNG, 'other.png', 'image/png').expect(404);
    await download('partner', mine.body.id).expect(404);
    await as(
      'partner',
      request(server()).delete(`/transactions/attachments/${mine.body.id}`),
    ).expect(404);

    await download('owner', mine.body.id).expect(200);
    await as('owner', request(server()).delete(`/transactions/attachments/${mine.body.id}`)).expect(
      200,
    );
  });

  it('refuses an oversized file, a type a row may not carry and bytes that lie about their type', async () => {
    const before = fs.readdirSync(resolveUploadsDir()).length;
    const big = Buffer.concat([PDF, Buffer.alloc(10 * 1024 * 1024)]);

    await upload('owner', txId, big, 'huge.pdf', 'application/pdf').expect(413);
    const csv = await upload('owner', txId, Buffer.from('a,b\n1,2\n'), 't.csv', 'text/csv').expect(
      400,
    );
    expect(csv.body.error.code).toBe('TRANSACTION_ATTACHMENT_TYPE_UNSUPPORTED');
    const svg = await upload(
      'owner',
      txId,
      Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'),
      'x.svg',
      'image/svg+xml',
    ).expect(400);
    expect(svg.body.error.code).toBe('FILE_TYPE_NOT_ALLOWED_LIST');
    const fake = await upload(
      'owner',
      txId,
      Buffer.from('<html><script>alert(1)</script></html>'),
      'photo.png',
      'image/png',
    ).expect(400);
    expect(fake.body.error.code).toBe('FILE_SIGNATURE_MISMATCH');

    const listed = await as('owner', request(server()).get(`/transactions/${txId}/attachments`));
    expect(listed.body).toEqual([]);
    // Every refused upload was deleted from the uploads dir again.
    expect(fs.readdirSync(resolveUploadsDir()).length).toBe(before);
  });

  it('keeps a hostile file name as text: no path, no control characters, quoted on the way out', async () => {
    const hostile = '../../etc/‮gnp.exe";x=<script>.png';
    const uploaded = await upload('owner', txId, PNG, hostile, 'image/png').expect(201);

    expect(uploaded.body.fileName).not.toContain('/');
    expect(uploaded.body.fileName).not.toContain('‮');
    expect(uploaded.body.fileName).toBe('gnp.exe";x=<script>.png');
    const [{ stored_file_name: stored }] = await dataSource.query(
      'SELECT stored_file_name FROM transaction_attachments WHERE id = $1',
      [uploaded.body.id],
    );
    expect(stored).toMatch(/^[0-9a-f-]{36}\.png$/);

    const file = await download('owner', uploaded.body.id).expect(200);
    // Percent-encoded: the quote cannot end the filename parameter early.
    expect(file.headers['content-disposition']).toBe(
      `attachment; filename="${encodeURIComponent(uploaded.body.fileName)}"; filename*=UTF-8''${encodeURIComponent(uploaded.body.fileName)}`,
    );

    await as(
      'owner',
      request(server()).delete(`/transactions/attachments/${uploaded.body.id}`),
    ).expect(200);
  });

  it('keeps a name outside ASCII as it was written', async () => {
    const name = 'Kassenbon März – Café №7.pdf';
    const uploaded = await upload('owner', txId, PDF, name, 'application/pdf').expect(201);

    expect(uploaded.body.fileName).toBe(name);

    await as(
      'owner',
      request(server()).delete(`/transactions/attachments/${uploaded.body.id}`),
    ).expect(200);
  });

  it('makes one attachment of the same file sent twice at once', async () => {
    const [first, second] = await Promise.all([
      upload('owner', txId, PDF, 'twice.pdf', 'application/pdf'),
      upload('owner', txId, PDF, 'twice.pdf', 'application/pdf'),
    ]);

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(second.body.id).toBe(first.body.id);
    const listed = await as('owner', request(server()).get(`/transactions/${txId}/attachments`));
    expect(listed.body).toHaveLength(1);

    await as('owner', request(server()).delete(`/transactions/attachments/${first.body.id}`)).expect(
      200,
    );
  });

  it('keeps a different file with the same name and size', async () => {
    const other = Buffer.from(PDF);
    other[other.length - 1] = 0x21;
    const first = await upload('owner', txId, PDF, 'same.pdf', 'application/pdf').expect(201);
    const second = await upload('owner', txId, other, 'same.pdf', 'application/pdf').expect(201);

    expect(second.body.id).not.toBe(first.body.id);
    expect((await download('owner', second.body.id).expect(200)).body).toEqual(other);
    for (const id of [first.body.id, second.body.id]) {
      await as('owner', request(server()).delete(`/transactions/attachments/${id}`)).expect(200);
    }
  });

  it("refuses to unsplit when a part private to another member has files, and keeps them hidden", async () => {
    const whole = await bookExpense('ACME Store - Split Order');
    await as('owner', request(server()).post(`/transactions/${whole}/split`))
      .send({ parts: [{ amount: 30 }, { amount: 12 }] })
      .expect((res: request.Response) => expect(res.status).toBeLessThan(300));
    const parts = await as('owner', request(server()).get(`/transactions/${whole}/split`)).expect(
      200,
    );
    const partnerPart = parts.body.find((part: { id: string }) => part.id !== whole).id;
    await as('owner', request(server()).put(`/transactions/${partnerPart}`))
      .send({ ownerMemberId: await memberId('partner') })
      .expect(200);
    await as('partner', request(server()).put(`/transactions/${partnerPart}`))
      .send({ isPrivate: true })
      .expect(200);
    const secret = await upload('partner', partnerPart, PNG, 'gift.png', 'image/png').expect(201);
    await download('owner', secret.body.id).expect(404);

    const refused = await as('owner', request(server()).post(`/transactions/${whole}/unsplit`));
    expect(refused.status).toBe(400);
    expect(refused.body.error.code).toBe('TRANSACTION_UNSPLIT_PRIVATE_FILES');
    await download('owner', secret.body.id).expect(404);
    await download('partner', secret.body.id).expect(200);

    // Once the partner takes the file away, the parts merge as before.
    await as(
      'partner',
      request(server()).delete(`/transactions/attachments/${secret.body.id}`),
    ).expect(200);
    const merged = await as('owner', request(server()).post(`/transactions/${whole}/unsplit`));
    expect(merged.status).toBeLessThan(300);
  });

  it("refuses to unsplit when a shared part's files would land on a row private to someone else", async () => {
    const whole = await bookExpense('ACME Store - Shared Then Private');
    await as('owner', request(server()).post(`/transactions/${whole}/split`))
      .send({ parts: [{ amount: 30 }, { amount: 12 }] })
      .expect((res: request.Response) => expect(res.status).toBeLessThan(300));
    const parts = await as('owner', request(server()).get(`/transactions/${whole}/split`)).expect(
      200,
    );
    const sharedPart = parts.body.find((part: { id: string }) => part.id !== whole).id;
    const partnersFile = await upload('partner', sharedPart, PNG, 'mine.png', 'image/png').expect(201);
    // The part that survives a merge becomes the owner's private row.
    await as('owner', request(server()).put(`/transactions/${whole}`))
      .send({ ownerMemberId: await memberId('owner') })
      .expect(200);
    await as('owner', request(server()).put(`/transactions/${whole}`))
      .send({ isPrivate: true })
      .expect(200);

    const refused = await as('owner', request(server()).post(`/transactions/${whole}/unsplit`));
    expect(refused.status).toBe(400);
    expect(refused.body.error.code).toBe('TRANSACTION_UNSPLIT_HIDES_FILES');
    // The uploader keeps the file where they put it.
    await download('partner', partnersFile.body.id).expect(200);

    await as(
      'partner',
      request(server()).delete(`/transactions/attachments/${partnersFile.body.id}`),
    ).expect(200);
    const merged = await as('owner', request(server()).post(`/transactions/${whole}/unsplit`));
    expect(merged.status).toBeLessThan(300);
  });

  it('sets aside only files no row names: other workspaces, trashed statements, folders and other dirs stay', async () => {
    const root = ownUploadsDir();
    const mine = await upload('owner', txId, PDF, 'swept-not.pdf', 'application/pdf').expect(201);
    const theirsRow = await bookRow('ACME Store - Elsewhere', 'stranger');
    const theirs = await as(
      'stranger',
      request(server()).post(`/transactions/${theirsRow.id}/attachments`),
      accounts.stranger.workspaceId,
    )
      .attach('file', PNG, { filename: 'theirs.png', contentType: 'image/png' })
      .expect(201);
    const trashedRow = await bookRow('ACME Store - Trashed');
    const trashed = await upload('owner', trashedRow.id, PNG, 'trashed.png', 'image/png').expect(201);
    await as('owner', request(server()).post(`/statements/${trashedRow.statementId}/trash`)).expect(
      (res: request.Response) => expect(res.status).toBeLessThan(300),
    );

    const dir = path.join(root, 'transaction-attachments');
    const orphan = path.join(dir, 'orphan-from-a-deleted-row.pdf');
    const folder = path.join(dir, 'a-folder');
    const elsewhere = path.join(root, 'not-attachments-old.pdf');
    fs.writeFileSync(orphan, PDF);
    fs.mkdirSync(folder, { recursive: true });
    fs.writeFileSync(elsewhere, PDF);
    const kept = await Promise.all(
      [mine.body.id, theirs.body.id, trashed.body.id].map(id => storedNameOf(id)),
    );
    // Everything old enough to be swept.
    const old = new Date(Date.now() - 2 * 60 * 60 * 1000);
    for (const file of [orphan, folder, elsewhere, ...kept.map(name => path.join(dir, name))]) {
      fs.utimesSync(file, old, old);
    }

    const result = await app.get(TransactionAttachmentSweeperService).sweep();

    expect(result).toMatchObject({ status: 'swept', quarantined: 1 });
    expect(fs.existsSync(orphan)).toBe(false);
    // Set aside, not deleted: it waits 30 days in the trash of the day.
    const day = new Date().toISOString().slice(0, 10);
    expect(
      fs.existsSync(path.join(root, '.attachments-trash', day, 'orphan-from-a-deleted-row.pdf')),
    ).toBe(true);
    for (const name of kept) expect(fs.existsSync(path.join(dir, name))).toBe(true);
    expect(fs.existsSync(folder)).toBe(true);
    expect(fs.existsSync(elsewhere)).toBe(true);
    await download('owner', trashed.body.id).expect(200);
    await download('stranger', theirs.body.id, accounts.stranger.workspaceId).expect(200);

    fs.rmSync(folder, { recursive: true, force: true });
    fs.rmSync(elsewhere, { force: true });
    await as('owner', request(server()).delete(`/transactions/attachments/${mine.body.id}`)).expect(
      200,
    );
  });

  it('skips the sweep when more than 50 files would go, and touches none of them', async () => {
    const dir = path.join(ownUploadsDir(), 'transaction-attachments');
    fs.mkdirSync(dir, { recursive: true });
    const old = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const names = Array.from({ length: 51 }, (_, index) => `stray-${index}.pdf`);
    for (const name of names) {
      fs.writeFileSync(path.join(dir, name), PDF);
      fs.utimesSync(path.join(dir, name), old, old);
    }

    const result = await app.get(TransactionAttachmentSweeperService).sweep();

    expect(result).toMatchObject({ status: 'skipped', reason: 'too-many' });
    for (const name of names) expect(fs.existsSync(path.join(dir, name))).toBe(true);
    for (const name of names) fs.rmSync(path.join(dir, name));
  });

  it('skips the sweep when the database has no attachment rows but the folder has files', async () => {
    const dir = path.join(ownUploadsDir(), 'transaction-attachments');
    fs.mkdirSync(dir, { recursive: true });
    const stray = path.join(dir, 'stray-on-an-empty-database.pdf');
    fs.writeFileSync(stray, PDF);
    const old = new Date(Date.now() - 2 * 60 * 60 * 1000);
    fs.utimesSync(stray, old, old);
    // An empty table, as a fresh or wrong database would have, seen only inside
    // this transaction: rolled back afterwards, so nothing else notices.
    const runner = dataSource.createQueryRunner();
    await runner.startTransaction();
    try {
      await runner.query('DELETE FROM transaction_attachments');
      const sweeper = new TransactionAttachmentSweeperService(
        runner.manager.getRepository(TransactionAttachment),
      );

      const result = await sweeper.sweep();

      expect(result).toMatchObject({ status: 'skipped', reason: 'no-rows' });
      expect(fs.existsSync(stray)).toBe(true);
    } finally {
      await runner.rollbackTransaction();
      await runner.release();
      fs.rmSync(stray, { force: true });
    }
  });

  it("restores an old backup's file only when the restorer can read it on this server", async () => {
    const readable = await upload('owner', txId, PDF, 'old-backup.pdf', 'application/pdf').expect(201);
    const strangerRow = await bookRow('ACME Store - Not Yours', 'stranger');
    const foreign = await as(
      'stranger',
      request(server()).post(`/transactions/${strangerRow.id}/attachments`),
      accounts.stranger.workspaceId,
    )
      .attach('file', PNG, { filename: 'foreign.png', contentType: 'image/png' })
      .expect(201);
    const snapshot = await app.get(BackupDataService).collect(accounts.owner.workspaceId);
    const row = (snapshot.collections.transaction_attachments as Array<Record<string, unknown>>).find(
      item => item.id === readable.body.id,
    ) as Record<string, unknown>;
    // As a backup made before files were carried: bare stored names, no bytes.
    const legacy = {
      ...snapshot.collections,
      transaction_attachments: [
        { ...row, storedFileName: await storedNameOf(readable.body.id) },
        { ...row, id: randomUUID(), storedFileName: await storedNameOf(foreign.body.id) },
      ],
    };
    const password = 'legacy attachment backup';
    const archive = await new BackupArchiveService().create({
      password,
      workspace: { id: accounts.owner.workspaceId, name: 'Legacy' },
      collections: {
        workspace: [{ id: accounts.owner.workspaceId, name: 'Legacy', currency: 'EUR' }],
        ...legacy,
      },
      files: snapshot.files.filter(file => !file.path.startsWith('transaction-attachments/')),
    });
    const preview = await as('owner', request(server()).post('/backups/import/preview'))
      .attach('file', archive, 'legacy.seneca-backup')
      .field('password', password)
      .expect(201);
    const restored = await as(
      'owner',
      request(server()).post(`/backups/imports/${preview.body.importId}/restore`),
    )
      .attach('file', archive, 'legacy.seneca-backup')
      .field('password', password);
    expect(restored.status).toBeLessThan(300);
    restoredWorkspaceIds.push(restored.body.workspaceId);

    const copies = await dataSource.query(
      'SELECT id, file_name, stored_file_name FROM transaction_attachments WHERE workspace_id = $1',
      [restored.body.workspaceId],
    );
    expect(copies).toHaveLength(1);
    expect(copies[0].stored_file_name).not.toBe(await storedNameOf(readable.body.id));
    const file = await download('owner', copies[0].id, restored.body.workspaceId).expect(200);
    expect(file.body).toEqual(PDF);

    await as(
      'owner',
      request(server()).delete(`/transactions/attachments/${readable.body.id}`),
    ).expect(200);
  });

  it("does not hand another member's private file to someone restoring an old backup", async () => {
    const secret = await upload('owner', privateTxId, PNG, 'private.png', 'image/png').expect(201);
    const snapshot = await app.get(BackupDataService).collect(accounts.owner.workspaceId);
    const row = (snapshot.collections.transaction_attachments as Array<Record<string, unknown>>).find(
      item => item.id === secret.body.id,
    ) as Record<string, unknown>;
    const password = 'legacy private backup';
    const archive = await new BackupArchiveService().create({
      password,
      workspace: { id: accounts.owner.workspaceId, name: 'Legacy private' },
      collections: {
        workspace: [{ id: accounts.owner.workspaceId, name: 'Legacy private', currency: 'EUR' }],
        ...snapshot.collections,
        transaction_attachments: [{ ...row, storedFileName: await storedNameOf(secret.body.id) }],
      },
      files: snapshot.files.filter(file => !file.path.startsWith('transaction-attachments/')),
    });
    // The partner belongs to the workspace, but the row is the owner's private one.
    const preview = await as('partner', request(server()).post('/backups/import/preview'))
      .attach('file', archive, 'legacy-private.seneca-backup')
      .field('password', password)
      .expect(201);
    const restored = await as(
      'partner',
      request(server()).post(`/backups/imports/${preview.body.importId}/restore`),
    )
      .attach('file', archive, 'legacy-private.seneca-backup')
      .field('password', password);
    expect(restored.status).toBeLessThan(300);
    restoredWorkspaceIds.push(restored.body.workspaceId);

    const copies = await dataSource.query(
      'SELECT id FROM transaction_attachments WHERE workspace_id = $1',
      [restored.body.workspaceId],
    );
    expect(copies).toEqual([]);

    await as(
      'owner',
      request(server()).delete(`/transactions/attachments/${secret.body.id}`),
    ).expect(200);
  });

  it('carries the file through a backup into a restored copy that owns its own bytes', async () => {
    const original = await upload('owner', txId, PDF, 'kept.pdf', 'application/pdf').expect(201);
    const password = 'attachment backup password';
    const snapshot = await app.get(BackupDataService).collect(accounts.owner.workspaceId);
    const archive = await new BackupArchiveService().create({
      password,
      workspace: { id: accounts.owner.workspaceId, name: 'Attachments' },
      collections: {
        workspace: [{ id: accounts.owner.workspaceId, name: 'Attachments', currency: 'EUR' }],
        ...snapshot.collections,
      },
      files: snapshot.files,
    });
    const preview = await as('owner', request(server()).post('/backups/import/preview'))
      .attach('file', archive, 'attachments.seneca-backup')
      .field('password', password)
      .expect(201);
    const restored = await as(
      'owner',
      request(server()).post(`/backups/imports/${preview.body.importId}/restore`),
    )
      .attach('file', archive, 'attachments.seneca-backup')
      .field('password', password);
    expect(restored.status).toBeLessThan(300);
    const copyWorkspace = restored.body.workspaceId as string;
    restoredWorkspaceIds.push(copyWorkspace);

    const [copy] = await dataSource.query(
      'SELECT id, stored_file_name FROM transaction_attachments WHERE workspace_id = $1 AND file_name = $2',
      [copyWorkspace, 'kept.pdf'],
    );
    const [{ stored_file_name: originalStored }] = await dataSource.query(
      'SELECT stored_file_name FROM transaction_attachments WHERE id = $1',
      [original.body.id],
    );
    expect(copy.stored_file_name).not.toBe(originalStored);

    // Deleting the original leaves the copy's bytes where they are.
    await as(
      'owner',
      request(server()).delete(`/transactions/attachments/${original.body.id}`),
    ).expect(200);
    const file = await download('owner', copy.id, copyWorkspace).expect(200);
    expect(file.body).toEqual(PDF);
  });
});
