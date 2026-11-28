import * as crypto from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { WorkspaceRole } from '@/entities';
import { buildStorageService, errorCode, memoryRepo, transactionRepo } from './helpers/build-storage-service';

// Characterization tests: file versions, downloads and the bulk actions, pinned
// before they move out of StorageService.

const WS = 'ws-files';
const ADMIN = 'user-admin';
const BYTES = Buffer.from('%PDF-1.4 invented statement');
const HASH = crypto.createHash('sha256').update(BYTES).digest('hex');

const file = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  workspaceId: WS,
  userId: 'user-uploader',
  fileName: `${id}.pdf`,
  fileType: 'pdf',
  fileSize: 1234,
  fileHash: HASH,
  filePath: `/uploads/${id}.pdf`,
  deletedAt: null as Date | null,
  ...extra,
});

function world(files: any[], extra: Parameters<typeof buildStorageService>[0] = {}) {
  return buildStorageService({
    statementRepository: memoryRepo(files),
    workspaceMemberRepository: memoryRepo([
      { id: 'm-admin', workspaceId: WS, userId: ADMIN, role: WorkspaceRole.ADMIN, permissions: null },
    ]),
    ...extra,
  });
}

/** The query builder createFileVersion reads file bytes through: one answer per query. */
function withFileDataQueries(deps: any, answers: any[]) {
  const qb: any = {};
  for (const method of ['addSelect', 'where', 'andWhere', 'orderBy']) {
    qb[method] = vi.fn(() => qb);
  }
  qb.getOne = vi.fn();
  for (const answer of answers) {
    qb.getOne.mockResolvedValueOnce(answer);
  }
  deps.statementRepository.createQueryBuilder.mockReturnValue(qb);
  return qb;
}

describe('Storage versions', () => {
  it('keeps the stored bytes as a version and answers its size as a string', async () => {
    const { service, deps } = world([file('st-1')]);
    withFileDataQueries(deps, [{ ...file('st-1'), fileData: BYTES }]);

    const version = await service.createFileVersion('st-1', ADMIN);

    expect(version).toEqual({
      id: expect.any(String),
      statementId: 'st-1',
      createdBy: ADMIN,
      fileHash: HASH,
      fileName: 'st-1.pdf',
      fileType: 'pdf',
      fileSize: '1234',
      createdAt: expect.any(Date),
    });
    expect(deps.fileVersionRepository.rows[0].fileData).toBe(BYTES);
  });

  it('reads the bytes from disk when the row holds none', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'storage-version-'));
    const onDisk = path.join(dir, 'st-1.pdf');
    fs.writeFileSync(onDisk, BYTES);
    const { service, deps } = world([file('st-1')]);
    withFileDataQueries(deps, [{ ...file('st-1'), fileData: null }]);
    deps.fileStorageService.resolveFilePath.mockReturnValue(onDisk);

    try {
      await service.createFileVersion('st-1', ADMIN);
      expect(Buffer.compare(deps.fileVersionRepository.rows[0].fileData, BYTES)).toBe(0);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('borrows the bytes of the same upload by the same user, newest first', async () => {
    const { service, deps } = world([file('st-1')]);
    const qb = withFileDataQueries(deps, [
      { ...file('st-1'), fileData: null },
      { ...file('st-0'), fileData: BYTES },
    ]);

    await service.createFileVersion('st-1', ADMIN);

    expect(qb.where).toHaveBeenCalledWith('statement.userId = :userId', { userId: 'user-uploader' });
    expect(qb.andWhere).toHaveBeenCalledWith('statement.fileHash = :fileHash', { fileHash: HASH });
    expect(qb.andWhere).toHaveBeenCalledWith('statement.id <> :id', { id: 'st-1' });
    expect(qb.orderBy).toHaveBeenCalledWith('statement.createdAt', 'DESC');
    expect(deps.fileVersionRepository.rows[0].fileData).toBe(BYTES);
  });

  it('refuses when no copy of the bytes is left', async () => {
    const { service, deps } = world([file('st-1')]);
    withFileDataQueries(deps, [{ ...file('st-1'), fileData: null }, null]);

    expect(await errorCode(service.createFileVersion('st-1', ADMIN))).toBe(
      'STORAGE_FILE_DATA_UNAVAILABLE_VERSIONING',
    );
  });

  it('refuses bytes that do not match the recorded hash', async () => {
    const { service, deps } = world([file('st-1')]);
    withFileDataQueries(deps, [{ ...file('st-1'), fileData: Buffer.from('changed') }]);

    expect(await errorCode(service.createFileVersion('st-1', ADMIN))).toBe('STORAGE_FILE_HASH_MISMATCH');
    expect(deps.fileVersionRepository.rows).toHaveLength(0);
  });

  it('lists versions newest first without their bytes', async () => {
    const { service, deps } = world([file('st-1')]);

    await service.listFileVersions('st-1', ADMIN);

    const [options] = deps.fileVersionRepository.find.mock.calls[0];
    expect(options.where).toEqual({ statementId: 'st-1' });
    expect(options.order).toEqual({ createdAt: 'DESC' });
    expect(options.select.fileData).toBeUndefined();
    expect(options.select.fileSize).toBe(true);
  });
});

describe('Storage downloads', () => {
  it('records how long a download took and where the bytes came from', async () => {
    const observe = vi.fn();
    const inc = vi.fn();
    const metricsService = {
      storageFileAccessDurationSeconds: { observe },
      storageFileAccessErrorsTotal: { inc },
    };
    const { service, deps } = world([file('st-1')], { metricsService });

    const answer = await service.downloadFile('st-1', ADMIN);
    expect(answer).toEqual({ stream: { statementId: 'st-1' }, fileName: 'st-1.pdf', mimeType: 'application/pdf' });
    expect(observe).toHaveBeenCalledWith(
      { action: 'download', source: 'disk', result: 'ok' },
      expect.any(Number),
    );

    deps.fileStorageService.getStatementFileStream.mockRejectedValueOnce(new Error('gone'));
    await expect(service.getFilePreview('st-1', ADMIN)).rejects.toThrow('gone');
    expect(observe).toHaveBeenCalledWith(
      { action: 'view', source: 'unknown', result: 'error' },
      expect.any(Number),
    );
    expect(inc).toHaveBeenCalledWith({ action: 'view', reason: 'access_failed' });
  });

  it('streams a shared download without asking who is calling', async () => {
    const { service } = world([file('st-1')]);

    const answer = await service.getSharedDownloadStream('st-1');

    expect(answer.fileName).toBe('st-1.pdf');
    expect(await errorCode(service.getSharedDownloadStream('st-missing'))).toBe('STORAGE_FILE_NOT_FOUND');
  });

  it('restores a lost file from its stored copy', async () => {
    const { service, deps } = world([file('st-1')]);
    expect(await errorCode(service.restoreFile('st-1', ADMIN))).toBe('STORAGE_FILE_DATA_UNAVAILABLE_RESTORE');

    deps.fileStorageService.restoreFile.mockResolvedValue({ source: 'db' });
    expect(await service.restoreFile('st-1', ADMIN)).toEqual({ status: 'restored', source: 'db' });
  });
});

describe('Storage bulk actions', () => {
  it('trashes each file once, counting the ones it did not find', async () => {
    const trashed = file('st-2', { deletedAt: new Date('2026-01-01') });
    const { service, deps } = world([file('st-1'), trashed]);

    const answer = await service.bulkDelete(['st-1', 'st-1', 'st-2', 'st-missing'], ADMIN);

    expect(answer).toEqual({ deleted: 2, missing: 1 });
    expect(deps.statementsService.remove).toHaveBeenCalledTimes(1);
    expect(deps.statementsService.remove).toHaveBeenCalledWith('st-1', ADMIN, WS);
  });

  it('trashes none when one of the files carries a filed tax row', async () => {
    const transactionRepository = transactionRepo([{ id: 'tx-1', statementId: 'st-2', taxLocked: true }]);
    const { service, deps } = world([file('st-1'), file('st-2')], { transactionRepository });

    expect(await errorCode(service.bulkDelete(['st-1', 'st-2'], ADMIN))).toBe('TAX_LOCKED');
    expect(deps.statementsService.remove).not.toHaveBeenCalled();
  });

  it('trashes none when the caller may not edit one of them', async () => {
    const { service, deps } = world([file('st-1'), file('st-other', { workspaceId: 'ws-other' })]);

    expect(await errorCode(service.bulkDelete(['st-1', 'st-other'], ADMIN))).toBe('STORAGE_ACCESS_DENIED');
    expect(deps.statementsService.remove).not.toHaveBeenCalled();
  });

  it('answers an empty batch without touching anything', async () => {
    const { service, deps } = world([]);

    expect(await service.bulkDelete(['st-x', 'st-y'], ADMIN)).toEqual({ deleted: 0, missing: 2 });
    expect(await service.bulkRestoreFromTrash(['st-x'], ADMIN)).toEqual({ restored: 0, missing: 1 });
    expect(await service.bulkDeleteFromTrash(['st-x'], ADMIN)).toEqual({ deleted: 0, missing: 1 });
    expect(deps.statementsService.remove).not.toHaveBeenCalled();
  });

  it('restores only what is in the trash', async () => {
    const { service, deps } = world([file('st-1'), file('st-2', { deletedAt: new Date('2026-01-01') })]);

    const answer = await service.bulkRestoreFromTrash(['st-1', 'st-2', 'st-missing'], ADMIN);

    expect(answer).toEqual({ restored: 1, missing: 1, skipped: 1 });
    expect(deps.statementRepository.rows.find((row: any) => row.id === 'st-2').deletedAt).toBeNull();
  });

  it('deletes for good only what is in the trash', async () => {
    const { service, deps } = world([file('st-1'), file('st-2', { deletedAt: new Date('2026-01-01') })]);

    const answer = await service.bulkDeleteFromTrash(['st-1', 'st-2'], ADMIN);

    expect(answer).toEqual({ deleted: 1, missing: 0, skipped: 1 });
    expect(deps.statementsService.permanentDelete).toHaveBeenCalledTimes(1);
    expect(deps.statementsService.permanentDelete).toHaveBeenCalledWith('st-2', ADMIN, WS, {
      fromTrash: true,
    });
  });

  it('hands out download links only for the files the caller may download', async () => {
    const previous = process.env.API_BASE_URL;
    process.env.API_BASE_URL = 'https://api.example.com/v1';
    try {
      const { service } = world([file('st-1'), file('st-other', { workspaceId: 'ws-other' })]);

      const answer = await service.bulkDownload(['st-1', 'st-other', 'st-1'], ADMIN);

      expect(answer).toEqual({
        files: [{ id: 'st-1', downloadUrl: 'https://api.example.com/v1/storage/files/st-1/download' }],
        requested: 2,
        allowed: 1,
      });
    } finally {
      if (previous === undefined) {
        delete process.env.API_BASE_URL;
      } else {
        process.env.API_BASE_URL = previous;
      }
    }
  });
});
