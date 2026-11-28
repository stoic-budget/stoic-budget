import { Injectable } from '@nestjs/common';
import type {
  CreateFolderBody,
  CreateSharedLinkBody,
  GrantPermissionBody,
  StorageViewBody,
  UpdateFolderBody,
  UpdatePermissionBody,
  UpdateSharedLinkBody,
} from '../../contracts';
import { FilePermissionType, Statement } from '../../entities';
import type { StorageViewFilters } from './interfaces/storage-view-filters.interface';
import { StorageFileActionsService } from './storage-file-actions.service';
import { StorageFilesQueryService } from './storage-files-query.service';
import { StorageFoldersService } from './storage-folders.service';
import { StoragePermissionsService } from './storage-permissions.service';
import { StorageSharedLinksService } from './storage-shared-links.service';
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
    private readonly storageFilesQuery: StorageFilesQueryService,
    private readonly storageFolders: StorageFoldersService,
    private readonly storageFileActions: StorageFileActionsService,
    private readonly storageVersions: StorageVersionsService,
    private readonly storageSharedLinks: StorageSharedLinksService,
    private readonly storagePermissions: StoragePermissionsService,
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

  createSharedLink(statementId: string, userId: string, dto: CreateSharedLinkBody) {
    return this.storageSharedLinks.createSharedLink(statementId, userId, dto);
  }

  getSharedLinks(statementId: string, userId: string) {
    return this.storageSharedLinks.getSharedLinks(statementId, userId);
  }

  updateSharedLink(linkId: string, userId: string, dto: UpdateSharedLinkBody) {
    return this.storageSharedLinks.updateSharedLink(linkId, userId, dto);
  }

  deleteSharedLink(linkId: string, userId: string) {
    return this.storageSharedLinks.deleteSharedLink(linkId, userId);
  }

  accessSharedLink(token: string, password?: string) {
    return this.storageSharedLinks.accessSharedLink(token, password);
  }

  grantPermission(statementId: string, grantedById: string, dto: GrantPermissionBody) {
    return this.storagePermissions.grantPermission(statementId, grantedById, dto);
  }

  getFilePermissions(statementId: string, userId: string) {
    return this.storagePermissions.getFilePermissions(statementId, userId);
  }

  updatePermission(permissionId: string, userId: string, dto: UpdatePermissionBody) {
    return this.storagePermissions.updatePermission(permissionId, userId, dto);
  }

  revokePermission(permissionId: string, userId: string) {
    return this.storagePermissions.revokePermission(permissionId, userId);
  }
}
