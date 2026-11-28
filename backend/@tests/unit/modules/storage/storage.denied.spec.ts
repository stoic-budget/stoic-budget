import { WorkspaceRole } from '@/entities';
import { buildStorageService, errorCode, memoryRepo } from './helpers/build-storage-service';

// Characterization tests: every StorageService method that touches a file asks
// the access rules first, for the right action, and changes nothing when they
// say no. A stranger is refused what a viewer may do; a viewer is refused what
// takes edit or share rights.

const WS = 'ws-files';
const STRANGER = 'user-stranger';
const VIEWER = 'user-viewer';
const FILE = {
  id: 'st-1',
  workspaceId: WS,
  userId: 'user-uploader',
  fileName: 'statement.pdf',
  fileHash: 'hash',
  folderId: 'folder-v',
  deletedAt: null,
};

function world() {
  const built = buildStorageService({
    statementRepository: memoryRepo([{ ...FILE }]),
    workspaceMemberRepository: memoryRepo([
      { id: 'm-viewer', workspaceId: WS, userId: VIEWER, role: WorkspaceRole.VIEWER, permissions: null },
      { id: 'm-x', workspaceId: WS, userId: 'user-x', role: WorkspaceRole.MEMBER, permissions: null },
    ]),
    folderRepository: memoryRepo([{ id: 'folder-v', workspaceId: WS, userId: VIEWER, name: 'Mine' }]),
    sharedLinkRepository: memoryRepo([{ id: 'link-1', statementId: FILE.id, token: 'token-1' }]),
    filePermissionRepository: memoryRepo([
      { id: 'perm-1', statementId: FILE.id, userId: 'user-x', isActive: true, permissionType: 'viewer' },
    ]),
  });
  const qb: any = {};
  for (const method of ['addSelect', 'where', 'andWhere', 'orderBy']) {
    qb[method] = vi.fn(() => qb);
  }
  qb.getOne = vi.fn(async () => ({ ...FILE, fileData: Buffer.from('bytes') }));
  built.deps.statementRepository.createQueryBuilder.mockReturnValue(qb);
  return built;
}

type Call = (service: any, userId: string) => Promise<unknown>;

const viewing: Array<[string, Call]> = [
  ['getFileDetails', (s, u) => s.getFileDetails(FILE.id, u)],
  ['listFileVersions', (s, u) => s.listFileVersions(FILE.id, u)],
  ['exportTransactionsCsv', (s, u) => s.exportTransactionsCsv(FILE.id, u)],
  ['getSharedLinks', (s, u) => s.getSharedLinks(FILE.id, u)],
  ['getFilePermissions', (s, u) => s.getFilePermissions(FILE.id, u)],
  ['getFilePreview', (s, u) => s.getFilePreview(FILE.id, u)],
  ['downloadFile', (s, u) => s.downloadFile(FILE.id, u)],
];

const editing: Array<[string, Call]> = [
  ['updateFileCategory', (s, u) => s.updateFileCategory(FILE.id, u, null)],
  ['updateFileTags', (s, u) => s.updateFileTags(FILE.id, u, [])],
  ['deleteFolder', (s, u) => s.deleteFolder('folder-v', u, WS, false)],
  ['moveFileToFolder', (s, u) => s.moveFileToFolder(FILE.id, u, null)],
  ['moveFileToTrash', (s, u) => s.moveFileToTrash(FILE.id, u)],
  ['restoreFileFromTrash', (s, u) => s.restoreFileFromTrash(FILE.id, u)],
  ['deleteFilePermanently', (s, u) => s.deleteFilePermanently(FILE.id, u)],
  ['createFileVersion', (s, u) => s.createFileVersion(FILE.id, u)],
  ['restoreFile', (s, u) => s.restoreFile(FILE.id, u)],
  ['bulkDelete', (s, u) => s.bulkDelete([FILE.id], u)],
  ['bulkRestoreFromTrash', (s, u) => s.bulkRestoreFromTrash([FILE.id], u)],
  ['bulkDeleteFromTrash', (s, u) => s.bulkDeleteFromTrash([FILE.id], u)],
];

const sharing: Array<[string, Call]> = [
  ['createSharedLink', (s, u) => s.createSharedLink(FILE.id, u, { permission: 'view' })],
  ['updateSharedLink', (s, u) => s.updateSharedLink('link-1', u, { description: 'changed' })],
  ['deleteSharedLink', (s, u) => s.deleteSharedLink('link-1', u)],
  ['grantPermission', (s, u) => s.grantPermission(FILE.id, u, { userId: 'user-x', permissionType: 'viewer' })],
  ['updatePermission', (s, u) => s.updatePermission('perm-1', u, { isActive: false })],
  ['revokePermission', (s, u) => s.revokePermission('perm-1', u)],
];

function expectNothingChanged(deps: any) {
  for (const [name, dep] of Object.entries<any>(deps)) {
    for (const write of ['save', 'update', 'remove', 'permanentDelete']) {
      if (dep && typeof dep[write]?.mock === 'object') {
        expect(dep[write], `${name}.${write}`).not.toHaveBeenCalled();
      }
    }
  }
  expect(deps.statementsService.remove).not.toHaveBeenCalled();
  expect(deps.fileStorageService.getStatementFileStream).not.toHaveBeenCalled();
  expect(deps.fileStorageService.restoreFile).not.toHaveBeenCalled();
}

describe('Storage refuses a stranger what a viewer may do', () => {
  it.each(viewing)('%s', async (_name, call) => {
    const { service, deps } = world();

    expect(await errorCode(call(service, STRANGER))).toBe('STORAGE_ACCESS_DENIED');
    expectNothingChanged(deps);
    expect(deps.transactionRepository.find).not.toHaveBeenCalled();
  });

  it.each(viewing)('lets a viewer %s', async (_name, call) => {
    const { service } = world();
    expect(await errorCode(call(service, VIEWER))).toBe('resolved');
  });

  it('a view-only grant may look but not download', async () => {
    const { service, deps } = world();
    deps.filePermissionRepository.rows.push({
      id: 'perm-s',
      statementId: FILE.id,
      userId: STRANGER,
      isActive: true,
      permissionType: 'viewer',
    });

    expect(await errorCode(service.getFileDetails(FILE.id, STRANGER))).toBe('resolved');
    expect(await errorCode(service.downloadFile(FILE.id, STRANGER))).toBe('STORAGE_ACTION_DENIED');
    expect((await service.bulkDownload([FILE.id], STRANGER)).allowed).toBe(0);
  });

  it('bulkDownload hands a stranger no links', async () => {
    const { service } = world();
    expect(await service.bulkDownload([FILE.id], STRANGER)).toEqual({ files: [], requested: 1, allowed: 0 });
  });
});

describe('Storage refuses a viewer what takes edit or share rights', () => {
  it.each([...editing, ...sharing])('%s', async (_name, call) => {
    const { service, deps } = world();

    expect(await errorCode(call(service, VIEWER))).toBe('STORAGE_ACCESS_DENIED');
    expectNothingChanged(deps);
  });
});
