import * as bcrypt from 'bcrypt';
import { PRIVATE_PLACEHOLDER } from '@/common/utils/transaction-privacy.util';
import { FilePermissionType, ShareLinkStatus, SharePermissionLevel, WorkspaceRole } from '@/entities';
import { buildStorageService, errorCode, memoryRepo } from './helpers/build-storage-service';

// Characterization tests: shared links and file permissions, pinned before
// they move out of StorageService.

const WS = 'ws-files';
const ADMIN = 'user-admin';
const FILE = { id: 'st-1', workspaceId: WS, userId: 'user-uploader', fileName: 'statement.pdf', deletedAt: null };

const link = (extra: Record<string, unknown> = {}) => ({
  id: 'link-1',
  token: 'token-1',
  statementId: FILE.id,
  statement: FILE,
  userId: ADMIN,
  permission: SharePermissionLevel.VIEW,
  status: ShareLinkStatus.ACTIVE,
  expiresAt: null as Date | null,
  password: null as string | null,
  allowAnonymous: true,
  accessCount: 0,
  lastAccessedAt: null,
  ...extra,
});

function world(opts: { links?: any[]; permissions?: any[]; transactions?: any[]; members?: any[]; files?: any[] } = {}) {
  return buildStorageService({
    statementRepository: memoryRepo(opts.files ?? [{ ...FILE }]),
    sharedLinkRepository: memoryRepo(opts.links ?? []),
    filePermissionRepository: memoryRepo(opts.permissions ?? []),
    transactionRepository: memoryRepo(opts.transactions ?? []),
    workspaceMemberRepository: memoryRepo(
      opts.members ?? [
        { id: 'm-admin', workspaceId: WS, userId: ADMIN, role: WorkspaceRole.ADMIN, permissions: null },
      ],
    ),
  });
}

describe('Shared links — creating and managing', () => {
  it('creates an active link with a fresh token, anonymous by default', async () => {
    const { service, deps } = world();

    const created = await service.createSharedLink(FILE.id, ADMIN, {
      permission: SharePermissionLevel.DOWNLOAD,
      description: 'For the accountant',
    } as any);

    expect(created).toMatchObject({
      statementId: FILE.id,
      userId: ADMIN,
      permission: SharePermissionLevel.DOWNLOAD,
      expiresAt: null,
      password: null,
      allowAnonymous: true,
      description: 'For the accountant',
      status: ShareLinkStatus.ACTIVE,
    });
    expect(created.token).toMatch(/^[0-9a-f]{64}$/);
    const second = await service.createSharedLink(FILE.id, ADMIN, { permission: 'view' } as any);
    expect(second.token).not.toBe(created.token);
  });

  it('stores a hash of the link password, never the password', async () => {
    const { service } = world();

    const created = await service.createSharedLink(FILE.id, ADMIN, {
      permission: 'view',
      password: 'invented-secret',
      allowAnonymous: false,
    } as any);

    expect(created.password).not.toBe('invented-secret');
    expect(await bcrypt.compare('invented-secret', created.password as string)).toBe(true);
    expect(created.allowAnonymous).toBe(false);
  });

  it('refuses to share a file in the trash', async () => {
    const { service } = world({ files: [{ ...FILE, deletedAt: new Date('2026-01-01') }] });

    expect(await errorCode(service.createSharedLink(FILE.id, ADMIN, { permission: 'view' } as any))).toBe(
      'STORAGE_FILE_IN_TRASH',
    );
  });

  it('lists links with the password masked', async () => {
    const { service } = world({ links: [link({ password: 'hash' }), link({ id: 'link-2', token: 't2' })] });

    const links = await service.getSharedLinks(FILE.id, ADMIN);

    expect(links.map(l => l.password)).toEqual(['******', null]);
  });

  it('updates only the fields sent, and clears the password with an empty one', async () => {
    const expiry = '2030-01-01T00:00:00.000Z';
    const { service } = world({ links: [link({ password: 'old-hash', description: 'kept' })] });

    const updated = await service.updateSharedLink('link-1', ADMIN, {
      permission: SharePermissionLevel.EDIT,
      status: ShareLinkStatus.REVOKED,
      expiresAt: expiry,
      allowAnonymous: false,
      password: '',
    } as any);

    expect(updated).toMatchObject({
      permission: SharePermissionLevel.EDIT,
      status: ShareLinkStatus.REVOKED,
      expiresAt: new Date(expiry),
      allowAnonymous: false,
      password: null,
      description: 'kept',
    });
  });

  it('hashes a new link password', async () => {
    const { service } = world({ links: [link()] });

    const updated = await service.updateSharedLink('link-1', ADMIN, { password: 'next-secret' } as any);

    expect(await bcrypt.compare('next-secret', updated.password as string)).toBe(true);
  });

  it('deletes a link, and answers not found for one that is gone', async () => {
    const { service, deps } = world({ links: [link()] });

    await service.deleteSharedLink('link-1', ADMIN);

    expect(deps.sharedLinkRepository.rows).toHaveLength(0);
    expect(await errorCode(service.deleteSharedLink('link-1', ADMIN))).toBe('STORAGE_SHARED_LINK_NOT_FOUND');
    expect(await errorCode(service.updateSharedLink('link-1', ADMIN, {} as any))).toBe(
      'STORAGE_SHARED_LINK_NOT_FOUND',
    );
  });

  it('lets only someone who may share manage a link', async () => {
    const viewer = { id: 'm-v', workspaceId: WS, userId: 'user-viewer', role: WorkspaceRole.VIEWER, permissions: null };
    const { service } = world({ links: [link()], members: [viewer] });

    expect(await errorCode(service.deleteSharedLink('link-1', 'user-viewer'))).toBe('STORAGE_ACCESS_DENIED');
    expect(await errorCode(service.updateSharedLink('link-1', 'user-viewer', {} as any))).toBe(
      'STORAGE_ACCESS_DENIED',
    );
  });
});

describe('Shared links — opening one', () => {
  const rows = [
    {
      id: 'tx-1',
      statementId: FILE.id,
      counterpartyName: 'ACME Clinic',
      paymentPurpose: 'Checkup',
      isPrivate: true,
      ownerMemberId: 'm-admin',
    },
    { id: 'tx-2', statementId: FILE.id, counterpartyName: 'ACME Store', isPrivate: false, ownerMemberId: null },
  ];

  it('answers not found for an unknown token', async () => {
    const { service } = world();
    expect(await errorCode(service.accessSharedLink('nope'))).toBe('STORAGE_SHARED_LINK_NOT_FOUND');
  });

  it('refuses a link that is not active', async () => {
    const { service } = world({ links: [link({ status: ShareLinkStatus.REVOKED })] });
    expect(await errorCode(service.accessSharedLink('token-1'))).toBe('STORAGE_SHARED_LINK_INACTIVE');
  });

  it('marks a link past its expiry as expired and refuses it', async () => {
    const { service, deps } = world({ links: [link({ expiresAt: new Date(Date.now() - 1000) })] });

    expect(await errorCode(service.accessSharedLink('token-1'))).toBe('STORAGE_SHARED_LINK_EXPIRED');
    expect(deps.sharedLinkRepository.rows[0].status).toBe(ShareLinkStatus.EXPIRED);
    expect(deps.sharedLinkRepository.rows[0].accessCount).toBe(0);
  });

  it('asks for the password, and refuses a wrong one', async () => {
    const password = await bcrypt.hash('invented-secret', 4);
    const { service, deps } = world({ links: [link({ password })] });

    expect(await errorCode(service.accessSharedLink('token-1'))).toBe('STORAGE_PASSWORD_REQUIRED');
    expect(await errorCode(service.accessSharedLink('token-1', 'wrong'))).toBe('STORAGE_PASSWORD_INVALID');
    expect(deps.sharedLinkRepository.rows[0].accessCount).toBe(0);
    expect(await errorCode(service.accessSharedLink('token-1', 'invented-secret'))).toBe('resolved');
  });

  it('a view link shows the file, counts the visit and shows no rows', async () => {
    const { service, deps } = world({ links: [link()], transactions: rows });

    const answer = await service.accessSharedLink('token-1');

    expect(answer).toEqual({
      statement: FILE,
      transactions: [],
      permission: SharePermissionLevel.VIEW,
      canDownload: false,
    });
    expect(deps.sharedLinkRepository.rows[0].accessCount).toBe(1);
    expect(deps.sharedLinkRepository.rows[0].lastAccessedAt).toBeInstanceOf(Date);
  });

  it.each([
    [SharePermissionLevel.DOWNLOAD, true],
    [SharePermissionLevel.EDIT, true],
  ])('a %s link shows the rows, every private one hidden (download: %s)', async (permission, canDownload) => {
    const { service } = world({ links: [link({ permission })], transactions: rows });

    const answer = await service.accessSharedLink('token-1');

    expect(answer.canDownload).toBe(canDownload);
    expect(answer.transactions.map(t => t.counterpartyName)).toEqual([PRIVATE_PLACEHOLDER, 'ACME Store']);
    expect(answer.transactions[0].paymentPurpose).toBe(PRIVATE_PLACEHOLDER);
  });
});

describe('File permissions', () => {
  const member2 = { id: 'm-2', workspaceId: WS, userId: 'user-2', role: WorkspaceRole.MEMBER, permissions: null };
  const admin = { id: 'm-admin', workspaceId: WS, userId: ADMIN, role: WorkspaceRole.ADMIN, permissions: null };

  it('grants a member of the file’s workspace, not reshareable by default', async () => {
    const { service } = world({ members: [admin, member2] });

    const granted = await service.grantPermission(FILE.id, ADMIN, {
      userId: 'user-2',
      permissionType: FilePermissionType.DOWNLOADER,
    } as any);

    expect(granted).toMatchObject({
      statementId: FILE.id,
      userId: 'user-2',
      grantedById: ADMIN,
      permissionType: FilePermissionType.DOWNLOADER,
      canReshare: false,
      expiresAt: null,
      isActive: true,
    });
  });

  it('refuses a second grant to the same person', async () => {
    const { service } = world({
      members: [admin, member2],
      permissions: [{ id: 'perm-1', statementId: FILE.id, userId: 'user-2', isActive: true }],
    });

    expect(
      await errorCode(service.grantPermission(FILE.id, ADMIN, { userId: 'user-2', permissionType: 'viewer' } as any)),
    ).toBe('STORAGE_PERMISSION_EXISTS');
  });

  it('updates only the fields sent', async () => {
    const { service } = world({
      permissions: [
        {
          id: 'perm-1',
          statementId: FILE.id,
          userId: 'user-2',
          permissionType: FilePermissionType.VIEWER,
          canReshare: false,
          isActive: true,
          expiresAt: new Date('2030-01-01'),
        },
      ],
    });

    const updated = await service.updatePermission('perm-1', ADMIN, {
      permissionType: FilePermissionType.EDITOR,
      isActive: false,
    } as any);

    expect(updated).toMatchObject({
      permissionType: FilePermissionType.EDITOR,
      canReshare: false,
      isActive: false,
      expiresAt: new Date('2030-01-01'),
    });
    expect(await errorCode(service.updatePermission('perm-x', ADMIN, {} as any))).toBe(
      'STORAGE_PERMISSION_NOT_FOUND',
    );
  });

  it('lists a file’s grants newest first', async () => {
    const { service, deps } = world();

    await service.getFilePermissions(FILE.id, ADMIN);

    expect(deps.filePermissionRepository.find).toHaveBeenCalledWith({
      where: { statementId: FILE.id },
      relations: { user: true, grantedBy: true },
      order: { createdAt: 'DESC' },
    });
  });
});
