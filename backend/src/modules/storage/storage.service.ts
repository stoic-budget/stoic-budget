import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { type Repository } from 'typeorm';
import { toEnum } from '../../common/effect/to-enum';
import { appError } from '../../common/errors/app-error';
import { hashPassword } from '../../common/utils/password-hash.util';
import { redactPrivateRows } from '../../common/utils/transaction-privacy.util';
import type {
  CreateFolderBody,
  CreateSharedLinkBody,
  GrantPermissionBody,
  StorageViewBody,
  UpdateFolderBody,
  UpdatePermissionBody,
  UpdateSharedLinkBody,
} from '../../contracts';
import {
  FilePermission,
  FilePermissionType,
  SharedLink,
  ShareLinkStatus,
  SharePermissionLevel,
  Statement,
  Transaction,
  WorkspaceMember,
} from '../../entities';
import type { StorageViewFilters } from './interfaces/storage-view-filters.interface';
import { StorageAccessService, type StorageAction } from './storage-access.service';
import { StorageFileActionsService } from './storage-file-actions.service';
import { StorageFilesQueryService } from './storage-files-query.service';
import { StorageFoldersService } from './storage-folders.service';
import { StorageVersionsService } from './storage-versions.service';

type FileAvailability = {
  onDisk: boolean;
  inDb: boolean;
  status: 'disk' | 'db' | 'both' | 'missing' | 'unknown';
};

type StorageStatement = Statement & {
  isOwner: boolean;
  permissionType: FilePermissionType | null | undefined;
  canReshare: boolean;
  sharedLinksCount: number;
  fileAvailability: FileAvailability;
  hasFileOnDisk: boolean;
  hasFileInDb: boolean;
};

/**
 * Storage service for managing file storage, sharing, and permissions
 */
@Injectable()
export class StorageService {
  constructor(
    @InjectRepository(SharedLink)
    private readonly sharedLinkRepository: Repository<SharedLink>,
    @InjectRepository(FilePermission)
    private readonly filePermissionRepository: Repository<FilePermission>,
    @InjectRepository(Statement)
    private readonly statementRepository: Repository<Statement>,
    @InjectRepository(WorkspaceMember)
    private readonly workspaceMemberRepository: Repository<WorkspaceMember>,
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    private readonly storageAccess: StorageAccessService,
    private readonly storageFilesQuery: StorageFilesQueryService,
    private readonly storageFolders: StorageFoldersService,
    private readonly storageFileActions: StorageFileActionsService,
    private readonly storageVersions: StorageVersionsService,
  ) {}

  getStorageFiles(userId: string, workspaceId: string, filters?: StorageViewFilters) {
    return this.storageFilesQuery.getStorageFiles(userId, workspaceId, filters);
  }

  getFileDetails(statementId: string, userId: string) {
    return this.storageFilesQuery.getFileDetails(statementId, userId);
  }

  updateFileCategory(statementId: string, userId: string, categoryId: string | null) {
    return this.storageFileActions.updateFileCategory(statementId, userId, categoryId);
  }

  updateFileTags(statementId: string, userId: string, tagIds: string[]) {
    return this.storageFileActions.updateFileTags(statementId, userId, tagIds);
  }

  createFolder(dto: CreateFolderBody, userId: string, workspaceId: string) {
    return this.storageFolders.createFolder(dto, userId, workspaceId);
  }

  listFolders(userId: string, workspaceId: string) {
    return this.storageFolders.listFolders(userId, workspaceId);
  }

  updateFolder(folderId: string, dto: UpdateFolderBody, userId: string, workspaceId: string) {
    return this.storageFolders.updateFolder(folderId, dto, userId, workspaceId);
  }

  deleteFolder(folderId: string, userId: string, workspaceId: string, deleteFiles: boolean) {
    return this.storageFolders.deleteFolder(folderId, userId, workspaceId, deleteFiles);
  }

  moveFileToFolder(statementId: string, userId: string, folderId: string | null) {
    return this.storageFolders.moveFileToFolder(statementId, userId, folderId);
  }

  moveFileToTrash(statementId: string, userId: string) {
    return this.storageFileActions.moveFileToTrash(statementId, userId);
  }

  restoreFileFromTrash(statementId: string, userId: string) {
    return this.storageFileActions.restoreFileFromTrash(statementId, userId);
  }

  deleteFilePermanently(statementId: string, userId: string) {
    return this.storageFileActions.deleteFilePermanently(statementId, userId);
  }

  createView(dto: StorageViewBody, userId: string, workspaceId: string) {
    return this.storageFolders.createView(dto, userId, workspaceId);
  }

  listViews(workspaceId: string) {
    return this.storageFolders.listViews(workspaceId);
  }

  deleteView(id: string, workspaceId: string) {
    return this.storageFolders.deleteView(id, workspaceId);
  }

  createFileVersion(statementId: string, userId: string) {
    return this.storageVersions.createFileVersion(statementId, userId);
  }

  listFileVersions(statementId: string, userId: string) {
    return this.storageVersions.listFileVersions(statementId, userId);
  }

  downloadFile(statementId: string, userId: string) {
    return this.storageVersions.downloadFile(statementId, userId);
  }

  restoreFile(statementId: string, userId: string) {
    return this.storageVersions.restoreFile(statementId, userId);
  }

  exportTransactionsCsv(statementId: string, userId: string) {
    return this.storageVersions.exportTransactionsCsv(statementId, userId);
  }

  bulkDelete(statementIds: string[], userId: string) {
    return this.storageFileActions.bulkDelete(statementIds, userId);
  }

  bulkRestoreFromTrash(statementIds: string[], userId: string) {
    return this.storageFileActions.bulkRestoreFromTrash(statementIds, userId);
  }

  bulkDeleteFromTrash(statementIds: string[], userId: string) {
    return this.storageFileActions.bulkDeleteFromTrash(statementIds, userId);
  }

  bulkDownload(statementIds: string[], userId: string) {
    return this.storageFileActions.bulkDownload(statementIds, userId);
  }

  getFilePreview(statementId: string, userId: string) {
    return this.storageVersions.getFilePreview(statementId, userId);
  }

  getSharedDownloadStream(statementId: string) {
    return this.storageVersions.getSharedDownloadStream(statementId);
  }

  /**
   * Create shared link
   */
  async createSharedLink(
    statementId: string,
    userId: string,
    dto: CreateSharedLinkBody,
  ): Promise<SharedLink> {
    // Check if user has permission to share
    await this.checkFileAccess(userId, statementId, 'share');
    const statement = await this.statementRepository.findOne({
      where: { id: statementId },
      select: {
        id: true,
        deletedAt: true,
      },
    });
    if (!statement) {
      throw new NotFoundException(appError('STORAGE_FILE_NOT_FOUND'));
    }
    if (statement.deletedAt) {
      throw new BadRequestException(appError('STORAGE_FILE_IN_TRASH'));
    }

    // Generate unique token
    const token = this.generateShareToken();

    // Hash password if provided
    const hashedPassword = dto.password ? await hashPassword(dto.password) : null;

    const sharedLink = this.sharedLinkRepository.create({
      statementId,
      userId,
      token,
      permission: toEnum(SharePermissionLevel, dto.permission),
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      password: hashedPassword,
      allowAnonymous: dto.allowAnonymous ?? true,
      description: dto.description,
      status: ShareLinkStatus.ACTIVE,
    });

    return await this.sharedLinkRepository.save(sharedLink);
  }

  /**
   * Get shared links for a statement
   */
  async getSharedLinks(statementId: string, userId: string) {
    // Check if user has access to view shared links
    await this.checkFileAccess(userId, statementId, 'view');

    const links = await this.sharedLinkRepository.find({
      where: { statementId },
      order: { createdAt: 'DESC' },
    });

    return links.map(link => ({
      ...link,
      // Don't expose password hash
      password: link.password ? '******' : null,
    }));
  }

  /**
   * Update shared link
   */
  async updateSharedLink(
    linkId: string,
    userId: string,
    dto: UpdateSharedLinkBody,
  ): Promise<SharedLink> {
    const link = await this.sharedLinkRepository.findOne({
      where: { id: linkId },
    });

    if (!link) {
      throw new NotFoundException(appError('STORAGE_SHARED_LINK_NOT_FOUND'));
    }

    // Check if user is owner
    await this.checkFileAccess(userId, link.statementId, 'share');

    // Update fields
    if (dto.permission != null) {
      link.permission = toEnum(SharePermissionLevel, dto.permission);
    }
    if (dto.expiresAt !== undefined) {
      link.expiresAt = dto.expiresAt ? new Date(dto.expiresAt) : null;
    }
    if (dto.password !== undefined) {
      link.password = dto.password ? await hashPassword(dto.password) : null;
    }
    if (dto.status != null) {
      link.status = toEnum(ShareLinkStatus, dto.status);
    }
    if (dto.allowAnonymous != null) {
      link.allowAnonymous = dto.allowAnonymous;
    }
    if (dto.description !== undefined) {
      link.description = dto.description;
    }

    return await this.sharedLinkRepository.save(link);
  }

  /**
   * Delete shared link
   */
  async deleteSharedLink(linkId: string, userId: string): Promise<void> {
    const link = await this.sharedLinkRepository.findOne({
      where: { id: linkId },
    });

    if (!link) {
      throw new NotFoundException(appError('STORAGE_SHARED_LINK_NOT_FOUND'));
    }

    // Check if user is owner
    await this.checkFileAccess(userId, link.statementId, 'share');

    await this.sharedLinkRepository.remove(link);
  }

  /**
   * Access shared link (public endpoint)
   */
  async accessSharedLink(token: string, password?: string) {
    const link = await this.sharedLinkRepository.findOne({
      where: { token },
      relations: {
        statement: {
          category: true,
        },
      },
    });

    if (!link) {
      throw new NotFoundException(appError('STORAGE_SHARED_LINK_NOT_FOUND'));
    }

    // Check if link is active
    if (link.status !== ShareLinkStatus.ACTIVE) {
      throw new ForbiddenException(appError('STORAGE_SHARED_LINK_INACTIVE'));
    }

    // Check if link is expired
    if (link.expiresAt && new Date(link.expiresAt) < new Date()) {
      // Auto-expire the link
      link.status = ShareLinkStatus.EXPIRED;
      await this.sharedLinkRepository.save(link);
      throw new ForbiddenException(appError('STORAGE_SHARED_LINK_EXPIRED'));
    }

    if (link.allowAnonymous === false) {
      throw new ForbiddenException(appError('STORAGE_SHARED_LINK_AUTH_REQUIRED'));
    }

    // Check password if required
    if (link.password) {
      if (!password) {
        throw new UnauthorizedException(appError('STORAGE_PASSWORD_REQUIRED'));
      }
      const isValid = await bcrypt.compare(password, link.password);
      if (!isValid) {
        throw new UnauthorizedException(appError('STORAGE_PASSWORD_INVALID'));
      }
    }

    // Update access count and last accessed
    link.accessCount += 1;
    link.lastAccessedAt = new Date();
    await this.sharedLinkRepository.save(link);

    // Get transactions if permission allows
    let transactions: Transaction[] = [];
    if (link.permission !== SharePermissionLevel.VIEW) {
      transactions = await this.transactionRepository.find({
        where: { statementId: link.statement.id },
        order: { transactionDate: 'DESC' },
        relations: {
          category: true,
          branch: true,
          wallet: true,
        },
      });
      // Whoever holds the link is nobody's member: every private row stays hidden.
      redactPrivateRows(transactions, null);
    }

    return {
      statement: link.statement,
      transactions,
      permission: link.permission,
      canDownload: [SharePermissionLevel.DOWNLOAD, SharePermissionLevel.EDIT].includes(
        link.permission,
      ),
    };
  }

  /**
   * Grant permission to user
   */
  async grantPermission(
    statementId: string,
    grantedById: string,
    dto: GrantPermissionBody,
  ): Promise<FilePermission> {
    // Check if granter has permission to share
    await this.checkFileAccess(grantedById, statementId, 'share');

    // dto.userId is an arbitrary id from the request body: without this the
    // file could be shared with any account in the system, in any tenant.
    const statement = await this.statementRepository.findOne({
      where: { id: statementId },
      select: {
        id: true,
        workspaceId: true,
      },
    });
    if (!statement) {
      throw new NotFoundException(appError('STORAGE_FILE_NOT_FOUND'));
    }

    // The dialog takes a user id or the email a member signs in with.
    const granteeMembership = await this.workspaceMemberRepository.findOne({
      where: dto.userId.includes('@')
        ? { workspaceId: statement.workspaceId, user: { email: dto.userId.trim().toLowerCase() } }
        : { workspaceId: statement.workspaceId, userId: dto.userId },
    });
    if (!granteeMembership) {
      throw new NotFoundException(appError('STORAGE_USER_NOT_IN_WORKSPACE'));
    }
    const granteeId = granteeMembership.userId;

    // Check if permission already exists
    const existing = await this.filePermissionRepository.findOne({
      where: { statementId, userId: granteeId },
    });

    if (existing) {
      throw new BadRequestException(appError('STORAGE_PERMISSION_EXISTS'));
    }

    const permission = this.filePermissionRepository.create({
      statementId,
      userId: granteeId,
      grantedById,
      permissionType: toEnum(FilePermissionType, dto.permissionType),
      canReshare: dto.canReshare ?? false,
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      isActive: true,
    });

    return await this.filePermissionRepository.save(permission);
  }

  /**
   * Get permissions for a statement
   */
  async getFilePermissions(statementId: string, userId: string) {
    // Check if user has access
    await this.checkFileAccess(userId, statementId, 'view');

    return await this.filePermissionRepository.find({
      where: { statementId },
      relations: {
        user: true,
        grantedBy: true,
      },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Update permission
   */
  async updatePermission(
    permissionId: string,
    userId: string,
    dto: UpdatePermissionBody,
  ): Promise<FilePermission> {
    const permission = await this.filePermissionRepository.findOne({
      where: { id: permissionId },
    });

    if (!permission) {
      throw new NotFoundException(appError('STORAGE_PERMISSION_NOT_FOUND'));
    }

    // Check if user is owner or granted the permission
    await this.checkFileAccess(userId, permission.statementId, 'share');

    // Update fields
    if (dto.permissionType != null) {
      permission.permissionType = toEnum(FilePermissionType, dto.permissionType);
    }
    if (dto.canReshare != null) {
      permission.canReshare = dto.canReshare;
    }
    if (dto.expiresAt !== undefined) {
      permission.expiresAt = dto.expiresAt ? new Date(dto.expiresAt) : null;
    }
    if (dto.isActive != null) {
      permission.isActive = dto.isActive;
    }

    return await this.filePermissionRepository.save(permission);
  }

  /**
   * Revoke permission
   */
  async revokePermission(permissionId: string, userId: string): Promise<void> {
    const permission = await this.filePermissionRepository.findOne({
      where: { id: permissionId },
    });

    if (!permission) {
      throw new NotFoundException(appError('STORAGE_PERMISSION_NOT_FOUND'));
    }

    // Check if user is owner or granted the permission
    await this.checkFileAccess(userId, permission.statementId, 'share');

    await this.filePermissionRepository.remove(permission);
  }

  /** Kept as a method of its own: specs replace it to skip the access rules. */
  private checkFileAccess(userId: string, statementId: string, requiredAction: StorageAction) {
    return this.storageAccess.checkFileAccess(userId, statementId, requiredAction);
  }

  /**
   * Generate unique share token
   */
  private generateShareToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }
}
