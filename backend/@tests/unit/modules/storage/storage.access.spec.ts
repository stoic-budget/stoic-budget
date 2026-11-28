import { FilePermissionType, WorkspaceRole } from '@/entities';
import { buildStorageService, errorCode, memoryRepo } from './helpers/build-storage-service';

// Characterization tests: who may view, download, edit and share a stored file
// today, pinned before the access check moves out of StorageService.

const WS = 'ws-files';
const UPLOADER = 'user-uploader';
const OTHER = 'user-other';
const FILE = { id: 'st-1', workspaceId: WS, userId: UPLOADER, fileName: 'statement.pdf' };

function world(opts: { members?: any[]; permissions?: any[] }) {
  return buildStorageService({
    statementRepository: memoryRepo([{ ...FILE }]),
    workspaceMemberRepository: memoryRepo(opts.members ?? []),
    filePermissionRepository: memoryRepo(opts.permissions ?? []),
  });
}

const member = (userId: string, role: WorkspaceRole, permissions: any = null) => ({
  id: `m-${userId}`,
  workspaceId: WS,
  userId,
  role,
  permissions,
});

const grant = (type: FilePermissionType, extra: Record<string, unknown> = {}) => ({
  id: 'perm-1',
  statementId: FILE.id,
  userId: OTHER,
  permissionType: type,
  canReshare: false,
  isActive: true,
  expiresAt: null,
  ...extra,
});

type Action = 'view' | 'download' | 'edit' | 'share';

/** One public method per action, each guarded by that action alone. */
function attempt(service: any, userId: string, action: Action) {
  switch (action) {
    case 'view':
      return service.listFileVersions(FILE.id, userId);
    case 'download':
      return service.downloadFile(FILE.id, userId);
    case 'edit':
      return service.moveFileToTrash(FILE.id, userId);
    case 'share':
      return service.createSharedLink(FILE.id, userId, { permission: 'view' });
  }
}

async function outcome(opts: Parameters<typeof world>[0], userId: string, action: Action) {
  const { service } = world(opts);
  const code = await errorCode(attempt(service, userId, action));
  return code === 'resolved' ? 'ok' : code;
}

describe('Storage access — the uploader', () => {
  it.each<[WorkspaceRole, any, Action, string]>([
    [WorkspaceRole.VIEWER, null, 'view', 'ok'],
    [WorkspaceRole.VIEWER, null, 'download', 'ok'],
    [WorkspaceRole.VIEWER, null, 'edit', 'STATEMENTS_EDIT_FORBIDDEN'],
    [WorkspaceRole.VIEWER, null, 'share', 'SHARING_FORBIDDEN'],
    [WorkspaceRole.MEMBER, { canEditStatements: true }, 'edit', 'ok'],
    [WorkspaceRole.MEMBER, { canEditStatements: true }, 'share', 'SHARING_FORBIDDEN'],
    [WorkspaceRole.MEMBER, { canShareFiles: true }, 'share', 'ok'],
    [WorkspaceRole.MEMBER, { canShareFiles: true }, 'edit', 'STATEMENTS_EDIT_FORBIDDEN'],
  ])('as %s with %j may %s: %s', async (role, permissions, action, expected) => {
    expect(await outcome({ members: [member(UPLOADER, role, permissions)] }, UPLOADER, action)).toBe(
      expected,
    );
  });

  it('is anyone once they left the workspace, down to an explicit grant', async () => {
    expect(await outcome({}, UPLOADER, 'view')).toBe('STORAGE_ACCESS_DENIED');
    const permissions = [grant(FilePermissionType.VIEWER, { userId: UPLOADER })];
    expect(await outcome({ permissions }, UPLOADER, 'view')).toBe('ok');
    expect(await outcome({ permissions }, UPLOADER, 'edit')).toBe('STORAGE_ACTION_DENIED');
  });

  it('counts no membership of another workspace', async () => {
    const elsewhere = { ...member(OTHER, WorkspaceRole.OWNER), workspaceId: 'ws-other' };
    expect(await outcome({ members: [elsewhere] }, OTHER, 'view')).toBe('STORAGE_ACCESS_DENIED');
  });
});

describe('Storage access — another member', () => {
  it.each<[WorkspaceRole, Action, string]>([
    [WorkspaceRole.VIEWER, 'view', 'ok'],
    [WorkspaceRole.VIEWER, 'download', 'ok'],
    [WorkspaceRole.MEMBER, 'edit', 'STORAGE_ACCESS_DENIED'],
    [WorkspaceRole.MEMBER, 'share', 'STORAGE_ACCESS_DENIED'],
    [WorkspaceRole.ADMIN, 'edit', 'ok'],
    [WorkspaceRole.ADMIN, 'share', 'ok'],
    [WorkspaceRole.OWNER, 'edit', 'ok'],
    [WorkspaceRole.OWNER, 'share', 'ok'],
  ])('as %s may %s: %s', async (role, action, expected) => {
    expect(await outcome({ members: [member(OTHER, role)] }, OTHER, action)).toBe(expected);
  });

  it('as a member, edits with an editor grant on the file', async () => {
    const members = [member(OTHER, WorkspaceRole.MEMBER)];
    expect(await outcome({ members, permissions: [grant(FilePermissionType.EDITOR)] }, OTHER, 'edit')).toBe(
      'ok',
    );
  });
});

describe('Storage access — an explicit grant', () => {
  it.each<[FilePermissionType, boolean, Action, string]>([
    [FilePermissionType.VIEWER, false, 'view', 'ok'],
    [FilePermissionType.VIEWER, false, 'download', 'STORAGE_ACTION_DENIED'],
    [FilePermissionType.DOWNLOADER, false, 'view', 'ok'],
    [FilePermissionType.DOWNLOADER, false, 'download', 'ok'],
    [FilePermissionType.DOWNLOADER, false, 'edit', 'STORAGE_ACTION_DENIED'],
    [FilePermissionType.EDITOR, false, 'download', 'ok'],
    [FilePermissionType.EDITOR, false, 'edit', 'ok'],
    [FilePermissionType.EDITOR, false, 'share', 'STORAGE_ACTION_DENIED'],
    [FilePermissionType.VIEWER, true, 'share', 'ok'],
    [FilePermissionType.OWNER, false, 'share', 'ok'],
  ])('%s (reshare %s) may %s: %s', async (type, canReshare, action, expected) => {
    expect(await outcome({ permissions: [grant(type, { canReshare })] }, OTHER, action)).toBe(expected);
  });

  it('stops at its expiry', async () => {
    const permissions = [grant(FilePermissionType.EDITOR, { expiresAt: new Date(Date.now() - 1000) })];
    expect(await outcome({ permissions }, OTHER, 'view')).toBe('STORAGE_PERMISSION_EXPIRED');
  });

  it('counts for nothing once switched off', async () => {
    const permissions = [grant(FilePermissionType.EDITOR, { isActive: false })];
    expect(await outcome({ permissions }, OTHER, 'view')).toBe('STORAGE_ACCESS_DENIED');
  });

  it('is a grant on that file only', async () => {
    const permissions = [grant(FilePermissionType.EDITOR, { statementId: 'st-elsewhere' })];
    expect(await outcome({ permissions }, OTHER, 'view')).toBe('STORAGE_ACCESS_DENIED');
  });

  it('answers not found for a file that does not exist', async () => {
    const { service } = world({});
    expect(await errorCode(service.listFileVersions('st-missing', OTHER))).toBe(
      'STORAGE_FILE_NOT_FOUND',
    );
  });
});
