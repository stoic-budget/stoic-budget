import { NotFoundException } from '@nestjs/common';
import { BackupDataService } from '../../../../src/modules/backups/backup-data.service';
import { Readable } from 'node:stream';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

describe('BackupDataService', () => {
  it('exports workspace-scoped business records but strips encrypted secrets, the account-mail grant and integrations', async () => {
    const categories = { find: vi.fn().mockResolvedValue([{ id: 'cat-1', workspaceId: 'ws-1', name: 'Travel' }]) };
    const serviceSettings = {
      find: vi.fn().mockResolvedValue([
        {
          id: 'setting-1',
          workspaceId: 'ws-1',
          key: 'smtp',
          config: { host: 'mail.example.com' },
          encryptedSecrets: { token: 'enc:secret' },
          accountMailUserId: 'member-1',
        },
      ]),
    };
    const integrations = { find: vi.fn() };
    const repositories = new Map([
      ['Category', categories],
      ['WorkspaceServiceSettings', serviceSettings],
      ['Integration', integrations],
    ]);
    const service = new BackupDataService({
      entityMetadatas: [
        metadata('categories', 'Category', ['id', 'workspaceId', 'name']),
        metadata('workspace_service_settings', 'WorkspaceServiceSettings', [
          'id',
          'workspaceId',
          'key',
          'config',
          'encryptedSecrets',
          'accountMailUserId',
        ]),
        metadata('integrations', 'Integration', ['id', 'workspaceId', 'provider']),
      ],
      getRepository: (target: string) => repositories.get(target),
      query: vi.fn(async () => [{ id: 'owner-member' }]),
    } as never);

    const snapshot = await service.collect('ws-1');

    expect(snapshot.collections.categories).toEqual([{ id: 'cat-1', workspaceId: 'ws-1', name: 'Travel' }]);
    expect(snapshot.collections.workspace_service_settings).toEqual([
      { id: 'setting-1', workspaceId: 'ws-1', key: 'smtp', config: { host: 'mail.example.com' } },
    ]);
    expect(snapshot.collections.integrations).toBeUndefined();
    expect(snapshot.files).toEqual([]);
    expect(integrations.find).not.toHaveBeenCalled();
  });

  it('adds original statement files and replaces local paths with portable backup paths', async () => {
    const statements = {
      find: vi.fn().mockResolvedValue([
        { id: 'statement-1', workspaceId: 'ws-1', fileName: 'bank.csv', filePath: '/uploads/bank.csv' },
      ]),
    };
    const service = new BackupDataService(
      {
        entityMetadatas: [metadata('statements', 'Statement', ['id', 'workspaceId', 'fileName', 'filePath'])],
        getRepository: () => statements,
        query: vi.fn(async () => [{ id: 'owner-member' }]),
      } as never,
      {
        getStatementFileStream: vi.fn().mockResolvedValue({
          stream: Readable.from(Buffer.from('date,amount\n')),
          fileName: 'bank.csv',
        }),
      } as never,
    );

    const snapshot = await service.collect('ws-1');

    expect(snapshot.collections.statements).toEqual([
      {
        id: 'statement-1',
        workspaceId: 'ws-1',
        fileName: 'bank.csv',
        filePath: 'statements/statement-1/bank.csv',
      },
    ]);
    expect(snapshot.files).toEqual([
      { path: 'statements/statement-1/bank.csv', contents: Buffer.from('date,amount\n') },
    ]);
  });

  it('includes receipt attachments and replaces machine-specific attachment paths', async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'seneca-receipt-'));
    const attachment = path.join(directory, 'receipt.jpg');
    await fs.writeFile(attachment, 'receipt image');
    const receipts = {
      find: vi.fn().mockResolvedValue([
        { id: 'receipt-1', workspaceId: 'ws-1', attachmentPaths: [attachment], subject: 'Taxi' },
      ]),
    };
    const service = new BackupDataService({
      entityMetadatas: [metadata('receipts', 'Receipt', ['id', 'workspaceId', 'attachmentPaths', 'subject'])],
      getRepository: () => receipts,
      query: vi.fn(async () => [{ id: 'owner-member' }]),
    } as never);

    const snapshot = await service.collect('ws-1');

    expect(snapshot.collections.receipts).toEqual([
      {
        id: 'receipt-1',
        workspaceId: 'ws-1',
        attachmentPaths: ['receipts/receipt-1/0-receipt.jpg'],
        subject: 'Taxi',
      },
    ]);
    expect(snapshot.files).toEqual([
      { path: 'receipts/receipt-1/0-receipt.jpg', contents: Buffer.from('receipt image') },
    ]);
    await fs.rm(directory, { recursive: true, force: true });
  });

  it('carries the business logo, so a restore can give the copy its own (#677)', async () => {
    const uploads = await fs.mkdtemp(path.join(os.tmpdir(), 'seneca-logo-'));
    const previous = process.env.UPLOADS_DIR;
    process.env.UPLOADS_DIR = uploads;
    await fs.mkdir(path.join(uploads, 'workspace-logos'), { recursive: true });
    await fs.writeFile(path.join(uploads, 'workspace-logos', 'acme.png'), 'ACME logo');
    const service = new BackupDataService({
      entityMetadatas: [metadata('workspace_business_profiles', 'Profile', ['workspaceId', 'logoFile'])],
      getRepository: () => ({ find: vi.fn().mockResolvedValue([{ workspaceId: 'ws-1', logoFile: 'acme.png' }]) }),
      query: vi.fn(async () => [{ id: 'owner-member' }]),
    } as never);

    const snapshot = await service.collect('ws-1');

    expect(snapshot.collections.workspace_business_profiles).toEqual([
      { workspaceId: 'ws-1', logoFile: 'workspace-logos/ws-1/acme.png' },
    ]);
    expect(snapshot.files.map(file => file.path)).toEqual(['workspace-logos/ws-1/acme.png']);
    if (previous === undefined) delete process.env.UPLOADS_DIR;
    else process.env.UPLOADS_DIR = previous;
    await fs.rm(uploads, { recursive: true, force: true });
  });

  it("carries the workspace's uploaded background with the snapshot (#677)", async () => {
    const uploads = await fs.mkdtemp(path.join(os.tmpdir(), 'seneca-bg-'));
    const previous = process.env.UPLOADS_DIR;
    process.env.UPLOADS_DIR = uploads;
    await fs.mkdir(path.join(uploads, 'workspace-backgrounds'), { recursive: true });
    await fs.writeFile(path.join(uploads, 'workspace-backgrounds', 'lake.jpg'), 'ACME lake');
    const service = new BackupDataService({ entityMetadatas: [], getRepository: () => ({}), query: vi.fn(async () => []) } as never);

    const snapshot = await service.collect('ws-1', '/uploads/workspace-backgrounds/lake.jpg');

    expect(snapshot.backgroundImage).toBe('workspace-backgrounds/ws-1/lake.jpg');
    expect(snapshot.files.map(file => file.path)).toEqual(['workspace-backgrounds/ws-1/lake.jpg']);
    if (previous === undefined) delete process.env.UPLOADS_DIR;
    else process.env.UPLOADS_DIR = previous;
    await fs.rm(uploads, { recursive: true, force: true });
  });

  it('leaves out a statement and a receipt photo whose files are gone, and names them (#639)', async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'seneca-receipt-'));
    const kept = path.join(directory, 'kept.jpg');
    await fs.writeFile(kept, 'receipt image');
    const lost = path.join(directory, 'lost.jpg');
    const rows: Record<string, unknown[]> = {
      Statement: [
        { id: 'statement-1', workspaceId: 'ws-1', fileName: 'bank.csv', filePath: '/uploads/bank.csv' },
      ],
      Receipt: [{ id: 'receipt-1', workspaceId: 'ws-1', attachmentPaths: [lost, kept] }],
    };
    const service = new BackupDataService(
      {
        entityMetadatas: [
          metadata('statements', 'Statement', ['id', 'workspaceId', 'fileName', 'filePath']),
          metadata('receipts', 'Receipt', ['id', 'workspaceId', 'attachmentPaths']),
        ],
        getRepository: (target: string) => ({ find: vi.fn().mockResolvedValue(rows[target]) }),
        query: vi.fn(async () => []),
      } as never,
      // As the storage does when neither the disk nor the database has the file.
      { getStatementFileStream: vi.fn().mockRejectedValue(new NotFoundException('FILE_CONTENT_UNAVAILABLE')) } as never,
    );

    const snapshot = await service.collect('ws-1');

    expect(snapshot.missingFiles).toEqual(['statement statement-1 (bank.csv)', 'receipt receipt-1 (lost.jpg)']);
    expect(snapshot.files.map(file => file.path)).toEqual(['receipts/receipt-1/1-kept.jpg']);
    expect(snapshot.collections.receipts).toEqual([
      { id: 'receipt-1', workspaceId: 'ws-1', attachmentPaths: ['receipts/receipt-1/1-kept.jpg'] },
    ]);
    // No server path in the archive, even for a file it does not carry.
    expect(snapshot.collections.statements).toEqual([
      expect.objectContaining({ filePath: 'statements/statement-1/bank.csv' }),
    ]);
    await fs.rm(directory, { recursive: true, force: true });
  });

  it('still fails when a statement file cannot be read for another reason', async () => {
    const service = new BackupDataService(
      {
        entityMetadatas: [metadata('statements', 'Statement', ['id', 'workspaceId', 'fileName', 'filePath'])],
        getRepository: () => ({
          find: vi.fn().mockResolvedValue([
            { id: 'statement-1', workspaceId: 'ws-1', fileName: 'bank.csv', filePath: '/uploads/bank.csv' },
          ]),
        }),
      } as never,
      { getStatementFileStream: vi.fn().mockRejectedValue(new Error('Connection terminated unexpectedly')) } as never,
    );

    await expect(service.collect('ws-1')).rejects.toThrow('Connection terminated unexpectedly');
  });

  it('includes statement file versions with binary data encoded for JSON', async () => {
    const statements = { find: vi.fn().mockResolvedValue([{ id: 'statement-1', workspaceId: 'ws-1' }]) };
    const versions = {
      find: vi.fn().mockResolvedValue([
        { id: 'version-1', statementId: 'statement-1', createdBy: 'old-user', fileData: Buffer.from('original') },
      ]),
    };
    const repositories = new Map([
      ['Statement', statements],
      ['FileVersion', versions],
    ]);
    const service = new BackupDataService({
      entityMetadatas: [
        metadata('statements', 'Statement', ['id', 'workspaceId']),
        metadata('file_versions', 'FileVersion', ['id', 'statementId', 'createdBy', 'fileData']),
      ],
      getRepository: (target: string) => repositories.get(target),
      query: vi.fn(async () => [{ id: 'owner-member' }]),
    } as never);

    const snapshot = await service.collect('ws-1');

    expect(snapshot.collections.file_versions).toEqual([
      {
        id: 'version-1',
        statementId: 'statement-1',
        createdBy: 'old-user',
        fileData: { encoding: 'base64', value: Buffer.from('original').toString('base64') },
      },
    ]);
  });
});

function metadata(tableName: string, target: string, properties: string[]) {
  return {
    tableName,
    target,
    columns: properties.map(propertyName => ({ propertyName })),
    primaryColumns: [{ propertyName: 'id' }],
  };
}

describe('BackupDataService — the owner (#640)', () => {
  it("names the owner's own member id, so a restore by the same person keeps their private rows theirs", async () => {
    const query = vi.fn(async () => [{ id: 'owner-member' }]);
    const service = new BackupDataService({ entityMetadatas: [], getRepository: vi.fn(), query } as never);

    const snapshot = await service.collect('ws-1');

    expect(snapshot.ownerMemberId).toBe('owner-member');
    expect(query).toHaveBeenCalledWith(expect.stringContaining('owner_id = member.user_id'), ['ws-1']);
  });
});
