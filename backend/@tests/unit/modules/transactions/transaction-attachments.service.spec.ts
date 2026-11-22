import * as fs from 'node:fs';
import * as path from 'node:path';
import { BadRequestException, NotFoundException } from '@nestjs/common';

// file-validator reads the uploads root once, at import: the directory has to
// be chosen before anything imports it. The passthrough mock gives this spec a
// module registry of its own, so no other spec has imported it first.
const uploadsDir = vi.hoisted(() => {
  const os = require('node:os');
  const fsSync = require('node:fs');
  const pathSync = require('node:path');
  const dir = fsSync.mkdtempSync(pathSync.join(os.tmpdir(), 'seneca-attachments-test-'));
  process.env.UPLOADS_DIR = dir;
  return dir as string;
});
vi.mock('@/common/utils/filename.util', async importOriginal => importOriginal());

import { TransactionAttachmentsService } from '@/modules/transactions/services/transaction-attachments.service';

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const ATTACHMENTS = path.join(uploadsDir, 'transaction-attachments');

const createRepoMock = () =>
  ({
    find: vi.fn().mockResolvedValue([]),
    findOne: vi.fn().mockResolvedValue(null),
    exists: vi.fn().mockResolvedValue(false),
    create: vi.fn((data: unknown) => data),
    save: vi.fn(async (entity: unknown) => entity),
    remove: vi.fn(async (entity: unknown) => entity),
  }) as any;

/** A file as multer leaves it: written under the uploads dir with a random name. */
function upload(name: string, mimetype: string, bytes: Buffer): Express.Multer.File {
  const filePath = path.join(uploadsDir, `upload-${Math.random().toString(36).slice(2)}`);
  fs.writeFileSync(filePath, bytes);
  return { originalname: name, mimetype, size: bytes.length, path: filePath } as Express.Multer.File;
}

describe('TransactionAttachmentsService', () => {
  const attachmentRepo = createRepoMock();
  const transactionRepo = createRepoMock();
  const query = vi.fn();
  let service: TransactionAttachmentsService;
  const scope = { workspaceId: 'ws-1', viewerMemberId: 'member-1', userId: 'user-1' };
  const sharedRow = { id: 'tx-1', isPrivate: false, ownerMemberId: null };

  beforeEach(() => {
    vi.clearAllMocks();
    attachmentRepo.findOne.mockResolvedValue(null);
    attachmentRepo.find.mockResolvedValue([]);
    attachmentRepo.exists.mockResolvedValue(false);
    transactionRepo.findOne.mockResolvedValue(sharedRow);
    attachmentRepo.manager = {
      transaction: async (work: (manager: unknown) => unknown) =>
        work({ query, getRepository: () => attachmentRepo }),
    };
    fs.rmSync(ATTACHMENTS, { recursive: true, force: true });
    service = new TransactionAttachmentsService(attachmentRepo, transactionRepo);
  });

  afterAll(() => {
    fs.rmSync(uploadsDir, { recursive: true, force: true });
  });

  const leftoverUploads = () => fs.readdirSync(uploadsDir).filter(name => name.startsWith('upload-'));

  it('refuses a transaction outside the workspace and drops the upload', async () => {
    transactionRepo.findOne.mockResolvedValue(null);

    await expect(
      service.create('tx-1', scope, upload('receipt.png', 'image/png', PNG)),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(leftoverUploads()).toEqual([]);
  });

  it("treats another member's private row as not found on every path", async () => {
    transactionRepo.findOne.mockResolvedValue({
      id: 'tx-1',
      isPrivate: true,
      ownerMemberId: 'member-2',
    });
    attachmentRepo.findOne.mockResolvedValue({ id: 'att-1', transactionId: 'tx-1' });

    await expect(service.list('tx-1', scope)).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      service.create('tx-1', scope, upload('receipt.png', 'image/png', PNG)),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.getForDownload('att-1', scope)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(service.remove('att-1', scope)).rejects.toBeInstanceOf(NotFoundException);
    expect(attachmentRepo.remove).not.toHaveBeenCalled();
  });

  it('lets the owner of a private row use its files', async () => {
    transactionRepo.findOne.mockResolvedValue({
      id: 'tx-1',
      isPrivate: true,
      ownerMemberId: 'member-1',
    });

    await expect(service.list('tx-1', scope)).resolves.toEqual([]);
  });

  it('never lets the uploaded name reach the filesystem path', async () => {
    const saved = await service.create(
      'tx-1',
      scope,
      upload('../../../../etc/‮gnp.exe\u0007.png', 'image/png', PNG),
    );

    // Display name: last segment, direction marks gone, a control character made visible.
    expect(saved.fileName).toBe('gnp.exe_.png');
    expect(saved.storedFileName).toMatch(/^[0-9a-f-]{36}\.png$/);
    expect(fs.readdirSync(ATTACHMENTS)).toEqual([saved.storedFileName]);
    expect(leftoverUploads()).toEqual([]);
    expect(saved.fileSize).toBe(String(PNG.length));
  });

  it('refuses bytes that are not what the type says, and deletes them', async () => {
    const html = Buffer.from('<html><script>alert(1)</script></html>');

    await expect(
      service.create('tx-1', scope, upload('photo.png', 'image/png', html)),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(leftoverUploads()).toEqual([]);
    expect(attachmentRepo.save).not.toHaveBeenCalled();
  });

  it('refuses a type the upload list allows but a row may not carry', async () => {
    const error = await service
      .create('tx-1', scope, upload('table.csv', 'text/csv', Buffer.from('a,b\n1,2\n')))
      .catch((caught: BadRequestException) => caught);

    expect(error).toBeInstanceOf(BadRequestException);
    expect((error as BadRequestException).getResponse()).toMatchObject({
      code: 'TRANSACTION_ATTACHMENT_TYPE_UNSUPPORTED',
    });
    expect(leftoverUploads()).toEqual([]);
  });

  it('answers the first row when the same bytes arrive twice, under a per-row lock', async () => {
    fs.mkdirSync(ATTACHMENTS, { recursive: true });
    fs.writeFileSync(path.join(ATTACHMENTS, 'first.png'), PNG);
    attachmentRepo.find.mockResolvedValue([
      { id: 'att-1', fileName: 'receipt.png', fileSize: String(PNG.length), storedFileName: 'first.png' },
    ]);

    const saved = await service.create('tx-1', scope, upload('receipt.png', 'image/png', PNG));

    expect(saved.id).toBe('att-1');
    expect(query).toHaveBeenCalledWith(expect.stringContaining('pg_advisory_xact_lock'), [
      'transaction-attachment:tx-1',
    ]);
    expect(attachmentRepo.save).not.toHaveBeenCalled();
    expect(leftoverUploads()).toEqual([]);
  });

  it('keeps a different file with the same name and size', async () => {
    const other = Buffer.from(PNG);
    other[PNG.length - 1] = 1;
    fs.mkdirSync(ATTACHMENTS, { recursive: true });
    fs.writeFileSync(path.join(ATTACHMENTS, 'first.png'), PNG);
    attachmentRepo.find.mockResolvedValue([
      { id: 'att-1', fileName: 'receipt.png', fileSize: String(PNG.length), storedFileName: 'first.png' },
    ]);

    const saved = await service.create('tx-1', scope, upload('receipt.png', 'image/png', other));

    expect(saved.id).not.toBe('att-1');
    expect(attachmentRepo.save).toHaveBeenCalledTimes(1);
    expect(fs.readFileSync(path.join(ATTACHMENTS, saved.storedFileName))).toEqual(other);
  });

  it('writes a server-side copy from memory', async () => {
    transactionRepo.exists.mockResolvedValue(true);

    const saved = await service.attachFromServer('tx-1', 'ws-1', 'user-1', {
      originalname: 'scan.png',
      mimetype: 'image/png',
      size: PNG.length,
      buffer: PNG,
    });

    expect(fs.readFileSync(path.join(ATTACHMENTS, saved.storedFileName))).toEqual(PNG);
  });

  it('reports a missing blob without creating the directory on a read', async () => {
    attachmentRepo.findOne.mockResolvedValue({
      id: 'att-1',
      transactionId: 'tx-1',
      storedFileName: 'not-on-disk.png',
      fileName: 'receipt.png',
      mimeType: 'image/png',
    });

    await expect(service.getForDownload('att-1', scope)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(fs.existsSync(ATTACHMENTS)).toBe(false);
  });

  it('serves a type off the list as plain bytes', async () => {
    fs.mkdirSync(ATTACHMENTS, { recursive: true });
    fs.writeFileSync(path.join(ATTACHMENTS, 'legacy.csv'), 'a,b');
    attachmentRepo.findOne.mockResolvedValue({
      id: 'att-1',
      transactionId: 'tx-1',
      storedFileName: 'legacy.csv',
      fileName: 'old.csv',
      mimeType: 'text/csv',
    });

    const download = await service.getForDownload('att-1', scope);

    expect(download.mimeType).toBe('application/octet-stream');
  });

  it('keeps a file another row still names', async () => {
    fs.mkdirSync(ATTACHMENTS, { recursive: true });
    fs.writeFileSync(path.join(ATTACHMENTS, 'shared.png'), PNG);
    attachmentRepo.findOne.mockResolvedValue({
      id: 'att-1',
      transactionId: 'tx-1',
      storedFileName: 'shared.png',
    });
    attachmentRepo.exists.mockResolvedValue(true);

    await service.remove('att-1', scope);

    expect(attachmentRepo.remove).toHaveBeenCalled();
    expect(fs.existsSync(path.join(ATTACHMENTS, 'shared.png'))).toBe(true);
  });

  it('removes the file with its last row, and the row even when the file is gone', async () => {
    fs.mkdirSync(ATTACHMENTS, { recursive: true });
    fs.writeFileSync(path.join(ATTACHMENTS, 'own.png'), PNG);
    attachmentRepo.findOne.mockResolvedValue({
      id: 'att-1',
      transactionId: 'tx-1',
      storedFileName: 'own.png',
    });

    await service.remove('att-1', scope);
    expect(fs.existsSync(path.join(ATTACHMENTS, 'own.png'))).toBe(false);

    await expect(service.remove('att-1', scope)).resolves.toBeUndefined();
    expect(attachmentRepo.remove).toHaveBeenCalledTimes(2);
  });
});
