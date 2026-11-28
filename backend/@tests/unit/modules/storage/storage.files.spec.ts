import { PRIVATE_PLACEHOLDER } from '@/common/utils/transaction-privacy.util';
import { FilePermissionType, WorkspaceRole } from '@/entities';
import { buildStorageService, errorCode, memoryRepo } from './helpers/build-storage-service';

// Characterization tests: the file list, file details, the CSV export,
// categories, tags, folders and the trash, pinned before they move out of
// StorageService.

const WS = 'ws-files';
const ME = 'user-me';
const ME_MEMBER = { id: 'm-me', workspaceId: WS, userId: ME, role: WorkspaceRole.MEMBER, permissions: null };

const file = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  workspaceId: WS,
  userId: ME,
  fileName: `${id}.pdf`,
  accountNumber: null as string | null,
  bankName: 'Example Bank',
  folderId: null as string | null,
  filePath: `/uploads/${id}.pdf`,
  tags: [] as any[],
  deletedAt: null as Date | null,
  ...extra,
});

function listWorld(owned: any[], opts: { shared?: any[]; members?: any[]; links?: any[] } = {}) {
  const built = buildStorageService({
    workspaceMemberRepository: memoryRepo(opts.members ?? [ME_MEMBER]),
    filePermissionRepository: memoryRepo(opts.shared ?? []),
    sharedLinkRepository: memoryRepo(opts.links ?? []),
  });
  const qb: any = {};
  for (const method of ['leftJoinAndSelect', 'where', 'orderBy', 'distinct']) {
    qb[method] = vi.fn(() => qb);
  }
  qb.getMany = vi.fn(async () => owned);
  built.deps.statementRepository.createQueryBuilder.mockReturnValue(qb);
  return built;
}

describe('Storage file list', () => {
  const files = [
    file('st-mine', { accountNumber: 'KZ00 1111', tags: [{ id: 'tag-a' }] }),
    file('st-peer', { userId: 'user-peer', bankName: 'Other Bank', folderId: 'folder-1' }),
    file('st-trash', { deletedAt: new Date('2026-01-01') }),
  ];

  it.each<[string, Record<string, unknown>, string[]]>([
    ['leaves the trash out by default', {}, ['st-mine', 'st-peer']],
    ['shows only the trash', { deleted: 'only' }, ['st-trash']],
    ['shows everything', { deleted: 'include' }, ['st-mine', 'st-peer', 'st-trash']],
    ['keeps my uploads', { scope: 'mine' }, ['st-mine']],
    ['keeps the others’ uploads', { scope: 'shared' }, ['st-peer']],
    ['filters by bank', { bankName: 'Other Bank' }, ['st-peer']],
    ['filters by folder', { folderId: 'folder-1' }, ['st-peer']],
    ['filters to no folder', { folderId: null }, ['st-mine']],
    ['searches file names and account numbers', { search: '1111' }, ['st-mine']],
    ['searches without case', { search: 'ST-PEER' }, ['st-peer']],
    ['filters by tag', { tagIds: ['tag-a'] }, ['st-mine']],
    ['filters by availability', { availability: 'db' }, []],
  ])('%s', async (_name, filters, expected) => {
    const { service } = listWorld(files);

    const list = await service.getStorageFiles(ME, WS, filters as any);

    expect(list.map(f => f.id)).toEqual(expected);
  });

  it('marks what each file lets the caller do', async () => {
    const shared = { ...file('st-shared', { userId: 'user-peer' }) };
    const { service } = listWorld([file('st-mine'), file('st-peer', { userId: 'user-peer' })], {
      links: [{ id: 'link-1', statementId: 'st-mine' }],
      shared: [{ userId: ME, isActive: true, statementId: 'st-shared', statement: shared, permissionType: 'editor' }],
    });

    const list = await service.getStorageFiles(ME, WS);

    expect(
      list.map(f => [f.id, f.isOwner, f.permissionType, Boolean(f.canReshare), f.sharedLinksCount]),
    ).toEqual([
      ['st-mine', true, FilePermissionType.OWNER, true, 1],
      ['st-peer', false, FilePermissionType.VIEWER, false, 0],
      ['st-shared', false, FilePermissionType.VIEWER, false, 0],
    ]);
    expect(list[0]).toMatchObject({
      fileAvailability: { onDisk: true, inDb: false, status: 'disk' },
      hasFileOnDisk: true,
      hasFileInDb: false,
    });
  });

  it('lets an admin reshare a peer’s file', async () => {
    const admin = { ...ME_MEMBER, role: WorkspaceRole.ADMIN };
    const { service } = listWorld([file('st-peer', { userId: 'user-peer' })], { members: [admin] });

    const [peer] = await service.getStorageFiles(ME, WS);

    expect(peer.canReshare).toBe(true);
  });

  it('works out availability from disk and stored bytes when it can', async () => {
    const { service, deps } = listWorld([file('st-1'), file('st-2')]);
    deps.fileStorageService.getStatementsWithFileData = vi.fn(async () => new Set(['st-2']));
    deps.fileStorageService.buildAvailability = vi.fn((onDisk: boolean, inDb: boolean) => ({
      onDisk,
      inDb,
      status: inDb ? 'both' : 'disk',
    }));

    const list = await service.getStorageFiles(ME, WS, { availability: 'both' } as any);

    expect(list.map(f => f.id)).toEqual(['st-2']);
    expect(deps.fileStorageService.getStatementsWithFileData).toHaveBeenCalledWith(['st-1', 'st-2']);
  });
});

describe('Storage file details and export', () => {
  const rows = [
    {
      id: 'tx-private',
      workspaceId: WS,
      statementId: 'st-1',
      transactionDate: '2026-03-04',
      documentNumber: 'D-1',
      counterpartyName: 'ACME Clinic',
      paymentPurpose: 'Checkup',
      isPrivate: true,
      ownerMemberId: 'm-peer',
    },
    {
      id: 'tx-own',
      workspaceId: WS,
      statementId: 'st-1',
      transactionDate: '2026-03-02',
      documentNumber: 'D-2',
      counterpartyName: '=ACME "Store"',
      counterpartyBin: '123',
      debit: 10,
      credit: null,
      currency: 'EUR',
      paymentPurpose: 'Line one\nline two',
      isPrivate: true,
      ownerMemberId: 'm-me',
    },
  ];

  function detailWorld() {
    return buildStorageService({
      statementRepository: memoryRepo([file('st-1', { userId: 'user-peer' })]),
      workspaceMemberRepository: memoryRepo([ME_MEMBER]),
      transactionRepository: memoryRepo(rows.map(row => ({ ...row }))),
      sharedLinkRepository: memoryRepo([{ id: 'link-1', statementId: 'st-1', password: 'hash' }]),
    });
  }

  it('shows a file with its rows, others’ private ones hidden, link passwords masked', async () => {
    const { service } = detailWorld();

    const details = await service.getFileDetails('st-1', ME);

    expect(details.transactions.map(t => t.counterpartyName)).toEqual([PRIVATE_PLACEHOLDER, '=ACME "Store"']);
    expect(details.sharedLinks.map(l => l.password)).toEqual(['******']);
    expect(details).toMatchObject({
      isOwner: false,
      userPermission: FilePermissionType.VIEWER,
      fileAvailability: { onDisk: true, inDb: false, status: 'disk' },
      hasFileOnDisk: true,
      hasFileInDb: false,
    });
  });

  it('exports the rows as CSV, others’ private ones hidden and formulas neutralized', async () => {
    const { service } = detailWorld();

    const { csv, fileName } = await service.exportTransactionsCsv('st-1', ME);

    expect(fileName).toBe('transactions-st-1.csv');
    expect(csv.split('\n')).toEqual([
      '"date","documentNumber","counterpartyName","counterpartyBin","debit","credit","currency","paymentPurpose"',
      `"2026-03-04","${PRIVATE_PLACEHOLDER}","${PRIVATE_PLACEHOLDER}","","","","","${PRIVATE_PLACEHOLDER}"`,
      `"2026-03-02","D-2","'=ACME ""Store""","123","10","","EUR","Line one line two"`,
    ]);
  });
});

describe('Storage categories and tags', () => {
  function world(extra: Parameters<typeof buildStorageService>[0] = {}) {
    return buildStorageService({
      statementRepository: memoryRepo([file('st-1')]),
      workspaceMemberRepository: memoryRepo([{ ...ME_MEMBER, role: WorkspaceRole.ADMIN }]),
      ...extra,
    });
  }

  it('answers only what changed when the category is set', async () => {
    const category = { id: 'cat-1', workspaceId: WS, name: 'Bills' };
    const { service } = world({ categoryRepository: { findOne: vi.fn(async () => category) } });

    expect(await service.updateFileCategory('st-1', ME, 'cat-1')).toEqual({
      id: 'st-1',
      categoryId: 'cat-1',
      category,
    });
    expect(await service.updateFileCategory('st-1', ME, null)).toEqual({
      id: 'st-1',
      categoryId: null,
      category: null,
    });
  });

  it('refuses an unknown category', async () => {
    const { service } = world({ categoryRepository: { findOne: vi.fn(async () => null) } });
    expect(await errorCode(service.updateFileCategory('st-1', ME, 'cat-x'))).toBe('CATEGORY_NOT_FOUND');
  });

  it('sets tags of the file’s own workspace, each once', async () => {
    const { service } = world({
      tagRepository: memoryRepo([
        { id: 'tag-a', workspaceId: WS },
        { id: 'tag-b', workspaceId: 'ws-other' },
      ]),
    });

    const saved = await service.updateFileTags('st-1', ME, ['tag-a', 'tag-a']);
    expect(saved.tags.map((t: any) => t.id)).toEqual(['tag-a']);
    expect(await errorCode(service.updateFileTags('st-1', ME, ['tag-a', 'tag-b']))).toBe(
      'STORAGE_TAG_NOT_FOUND',
    );
  });
});

describe('Storage folders and views', () => {
  const folders = [
    { id: 'folder-mine', workspaceId: WS, userId: ME, name: 'Mine' },
    { id: 'folder-shared', workspaceId: WS, userId: null, name: 'Shared' },
    { id: 'folder-peer', workspaceId: WS, userId: 'user-peer', name: 'Peer' },
    { id: 'folder-elsewhere', workspaceId: 'ws-other', userId: null, name: 'Elsewhere' },
    { id: 'folder-mine-elsewhere', workspaceId: 'ws-other', userId: ME, name: 'Mine elsewhere' },
  ];

  function world(files: any[] = [file('st-1')]) {
    return buildStorageService({
      statementRepository: memoryRepo(files),
      folderRepository: memoryRepo(folders),
      tagRepository: memoryRepo([{ id: 'tag-a', workspaceId: WS }, { id: 'tag-b', workspaceId: 'ws-other' }]),
      workspaceMemberRepository: memoryRepo([{ ...ME_MEMBER, role: WorkspaceRole.ADMIN }]),
    });
  }

  it('lists my folders and the workspace-wide ones, by name', async () => {
    const { service, deps } = world();

    const listed = await service.listFolders(ME, WS);

    expect(listed.map(f => f.id).sort()).toEqual(['folder-mine', 'folder-shared']);
    expect(deps.folderRepository.find.mock.calls[0][0].order).toEqual({ name: 'ASC' });
  });

  it('creates a folder with a tag of the workspace only', async () => {
    const { service } = world();

    const created = await service.createFolder({ name: 'Taxes', tagId: 'tag-a' } as any, ME, WS);
    expect(created).toMatchObject({ name: 'Taxes', userId: ME, workspaceId: WS, tagId: 'tag-a' });
    expect((await service.createFolder({ name: 'Plain', tagId: '' } as any, ME, WS)).tagId).toBeNull();
    expect(await errorCode(service.createFolder({ name: 'X', tagId: 'tag-b' } as any, ME, WS))).toBe(
      'STORAGE_TAG_NOT_FOUND',
    );
  });

  it('renames my own folder and clears its tag', async () => {
    const { service } = world();

    const updated = await service.updateFolder('folder-mine', { name: '  Renamed  ', tagId: '' } as any, ME, WS);

    expect(updated).toMatchObject({ name: 'Renamed', tagId: null, tag: null });
    expect(await errorCode(service.updateFolder('folder-shared', { name: 'X' } as any, ME, WS))).toBe(
      'STORAGE_FOLDER_NOT_FOUND',
    );
  });

  it('moves a file into a folder in reach, never another workspace’s', async () => {
    const { service } = world();

    expect(await service.moveFileToFolder('st-1', ME, 'folder-shared')).toEqual({ folderId: 'folder-shared' });
    expect(await errorCode(service.moveFileToFolder('st-1', ME, 'folder-elsewhere'))).toBe(
      'STORAGE_FOLDER_NOT_FOUND',
    );
    expect(await errorCode(service.moveFileToFolder('st-1', ME, 'folder-peer'))).toBe('STORAGE_FOLDER_NOT_FOUND');
    expect(await errorCode(service.moveFileToFolder('st-1', ME, 'folder-mine-elsewhere'))).toBe(
      'STORAGE_FOLDER_NOT_FOUND',
    );
    expect(await service.moveFileToFolder('st-1', ME, null)).toEqual({ folderId: null });
  });

  it('deleting a folder keeps its files out of any folder', async () => {
    const { service, deps } = world([file('st-1', { folderId: 'folder-mine' })]);

    expect(await service.deleteFolder('folder-mine', ME, WS, false)).toEqual({ deleted: true, filesDeleted: 0 });
    expect(deps.statementRepository.rows[0].folderId).toBeNull();
    expect(deps.folderRepository.rows.map((f: any) => f.id)).not.toContain('folder-mine');
  });

  it('deleting a folder with its files trashes those not in the trash yet', async () => {
    const { service, deps } = world([
      file('st-1', { folderId: 'folder-mine' }),
      file('st-2', { folderId: 'folder-mine', deletedAt: new Date('2026-01-01') }),
    ]);

    expect(await service.deleteFolder('folder-mine', ME, WS, true)).toEqual({ deleted: true, filesDeleted: 2 });
    expect(deps.statementsService.remove).toHaveBeenCalledTimes(1);
    expect(deps.statementsService.remove).toHaveBeenCalledWith('st-1', ME, WS);
  });

  it('keeps views per workspace', async () => {
    const { service, deps } = world();

    const view = await service.createView({ name: 'Recent' } as any, ME, WS);
    expect(view).toMatchObject({ name: 'Recent', userId: ME, workspaceId: WS, filters: {} });
    expect(await errorCode(service.deleteView(view.id, 'ws-other'))).toBe('STORAGE_VIEW_NOT_FOUND');
    expect(await service.deleteView(view.id, WS)).toEqual({ deleted: true });
    expect(deps.storageViewRepository.rows).toHaveLength(0);
  });
});

describe('Storage trash', () => {
  function world(files: any[]) {
    return buildStorageService({
      statementRepository: memoryRepo(files),
      workspaceMemberRepository: memoryRepo([{ ...ME_MEMBER, role: WorkspaceRole.ADMIN }]),
    });
  }

  it('trashes once and restores once', async () => {
    const { service } = world([file('st-1')]);

    const trashed = await service.moveFileToTrash('st-1', ME);
    expect(trashed).toEqual({ status: 'trashed', deletedAt: expect.any(Date) });
    expect(await service.moveFileToTrash('st-1', ME)).toEqual({
      status: 'already_trashed',
      deletedAt: trashed.deletedAt,
    });
    expect(await service.restoreFileFromTrash('st-1', ME)).toEqual({ status: 'restored' });
    expect(await service.restoreFileFromTrash('st-1', ME)).toEqual({ status: 'active' });
  });

  it('deletes for good only from the trash', async () => {
    const { service, deps } = world([file('st-1'), file('st-2', { deletedAt: new Date('2026-01-01') })]);

    expect(await errorCode(service.deleteFilePermanently('st-1', ME))).toBe('STORAGE_FILE_NOT_IN_TRASH');
    expect(await service.deleteFilePermanently('st-2', ME)).toEqual({ status: 'deleted' });
    expect(deps.statementsService.permanentDelete).toHaveBeenCalledWith('st-2', ME, WS, { fromTrash: true });
  });
});
