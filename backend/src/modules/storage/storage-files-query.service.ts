import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { appError } from '../../common/errors/app-error';
import { FileStorageService } from '../../common/services/file-storage.service';
import { redactPrivateRows } from '../../common/utils/transaction-privacy.util';
import {
  FilePermission,
  FilePermissionType,
  SharedLink,
  Statement,
  Tag,
  Transaction,
  WorkspaceRole,
} from '../../entities';
import type { StorageViewFilters } from './interfaces/storage-view-filters.interface';
import { StorageAccessService } from './storage-access.service';

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

/** The storage file list and one file's details, as the caller may see them. */
@Injectable()
export class StorageFilesQueryService {
  constructor(
    @InjectRepository(Statement)
    private readonly statementRepository: Repository<Statement>,
    @InjectRepository(FilePermission)
    private readonly filePermissionRepository: Repository<FilePermission>,
    @InjectRepository(SharedLink)
    private readonly sharedLinkRepository: Repository<SharedLink>,
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    private readonly fileStorageService: FileStorageService,
    private readonly storageAccess: StorageAccessService,
  ) {}

  /**
   * Get all files (statements) of the current workspace
   */
  async getStorageFiles(userId: string, workspaceId: string, filters?: StorageViewFilters) {
    try {
      // Scoped on the workspace the caller has open (the request header), not on
      // the user's own `workspaceId`: that is only the workspace they registered
      // with, so it showed the same files in every workspace they switched to.
      const ownedStatements = await this.statementRepository
        .createQueryBuilder('statement')
        .leftJoinAndSelect('statement.category', 'category')
        .leftJoinAndSelect('statement.user', 'owner')
        .leftJoinAndSelect('statement.folder', 'folder')
        .leftJoinAndSelect('statement.tags', 'tags')
        .where('statement.workspaceId = :workspaceId', { workspaceId })
        .orderBy('statement.createdAt', 'DESC')
        .distinct(true)
        .getMany();

      // Get all statements shared with user (if permissions table exists)
      let sharedPermissions: FilePermission[] = [];
      try {
        sharedPermissions = await this.filePermissionRepository.find({
          where: {
            userId,
            isActive: true,
          },
          relations: {
            statement: {
              category: true,
              user: true,
              folder: true,
              tags: true,
            },
          },
        });
      } catch (error) {
        // If permissions table doesn't exist yet, just use empty array
        console.warn('File permissions table may not exist yet:', getErrorMessage(error));
      }

      // A file is only ever shared with members of its own workspace, so the
      // ones from other workspaces belong to those workspaces' lists.
      const sharedStatements = sharedPermissions
        .map(perm => perm.statement)
        .filter(stmt => stmt !== null && stmt.workspaceId === workspaceId);

      // Combine and deduplicate
      const allStatements = [...ownedStatements];
      const ownedIds = new Set(ownedStatements.map(s => s.id));

      for (const sharedStmt of sharedStatements) {
        if (!ownedIds.has(sharedStmt.id)) {
          allStatements.push(sharedStmt);
        }
      }

      // Enrich with permissions info
      const workspaceRole = await this.storageAccess.findMembership(workspaceId, userId);

      const statementsWithFileData = this.fileStorageService.getStatementsWithFileData
        ? await this.fileStorageService.getStatementsWithFileData(allStatements.map(s => s.id))
        : new Set<string>();

      const enrichedStatements = await Promise.all(
        allStatements.map(async statement => {
          const isOwner = statement.userId === userId;
          const isWorkspacePeer = statement.workspaceId === workspaceId;
          let permission = null;
          let sharedLinks = 0;

          try {
            permission = await this.storageAccess.getUserPermissionForStatement(
              userId,
              statement.id,
            );
            sharedLinks = await this.sharedLinkRepository.count({
              where: { statementId: statement.id },
            });
          } catch (error) {
            console.warn('Storage tables may not exist yet:', getErrorMessage(error));
          }

          const permissionType = isOwner
            ? FilePermissionType.OWNER
            : isWorkspacePeer
              ? FilePermissionType.VIEWER
              : permission?.permissionType;

          const canReshare =
            isOwner ||
            (isWorkspacePeer &&
              workspaceRole &&
              [WorkspaceRole.OWNER, WorkspaceRole.ADMIN].includes(workspaceRole.role)) ||
            permission?.canReshare;

          const fileAvailability = this.fileStorageService.buildAvailability
            ? this.fileStorageService.buildAvailability(
                this.fileStorageService.isOnDisk(statement.filePath),
                statementsWithFileData.has(statement.id),
              )
            : this.fileStorageService.getFileAvailability
              ? await this.fileStorageService.getFileAvailability({
                  id: statement.id,
                  filePath: statement.filePath,
                })
              : { onDisk: false, inDb: false, status: 'unknown' };

          return {
            ...statement,
            isOwner,
            permissionType,
            canReshare,
            sharedLinksCount: sharedLinks,
            fileAvailability,
            hasFileOnDisk: fileAvailability.onDisk,
            hasFileInDb: fileAvailability.inDb,
          };
        }),
      );

      let filtered = enrichedStatements;
      const deletedFilter = filters?.deleted ?? 'exclude';
      if (deletedFilter === 'only') {
        filtered = filtered.filter(s => Boolean(s.deletedAt));
      } else if (deletedFilter !== 'include') {
        filtered = filtered.filter(s => !s.deletedAt);
      }

      if (filters?.scope === 'mine') {
        filtered = filtered.filter(s => s.userId === userId);
      } else if (filters?.scope === 'shared') {
        filtered = filtered.filter(s => s.userId !== userId);
      }

      if (filters?.bankName) {
        filtered = filtered.filter(s => s.bankName && s.bankName === filters.bankName);
      }

      if (filters?.folderId !== undefined) {
        filtered = filtered.filter(s => (s.folderId || null) === (filters.folderId || null));
      }

      if (filters?.availability) {
        filtered = filtered.filter(s => {
          const status = s.fileAvailability?.status || s.fileAvailability;
          if (filters.availability === 'both') {
            return status === 'both';
          }
          return status === filters.availability;
        });
      }

      if (filters?.search) {
        const q = filters.search.toLowerCase();
        filtered = filtered.filter(
          s =>
            (s.fileName || '').toLowerCase().includes(q) ||
            (s.accountNumber || '').toLowerCase().includes(q),
        );
      }

      if (filters?.tagIds?.length) {
        const tagSet = new Set(filters.tagIds);
        filtered = filtered.filter(
          s => Array.isArray(s.tags) && s.tags.some((t: Tag) => t && tagSet.has(t.id)),
        );
      }

      return filtered;
    } catch (error) {
      console.error('Error in getStorageFiles:', error);
      throw error;
    }
  }

  /**
   * Get file details with transactions
   */
  async getFileDetails(statementId: string, userId: string) {
    const statement = await this.statementRepository.findOne({
      where: { id: statementId },
      relations: {
        category: true,
        user: true,
        folder: true,
        tags: true,
      },
    });

    if (!statement) {
      throw new NotFoundException(appError('STORAGE_FILE_NOT_FOUND'));
    }

    // Check if user has access
    await this.storageAccess.checkFileAccess(userId, statementId, 'view');

    // Get transactions
    const transactions = await this.transactionRepository.find({
      where: { statementId },
      order: { transactionDate: 'DESC' },
      relations: {
        category: true,
        branch: true,
        wallet: true,
      },
    });

    // Get shared links
    const sharedLinks = await this.sharedLinkRepository.find({
      where: { statementId },
      order: { createdAt: 'DESC' },
    });

    // Get permissions
    const permissions = await this.filePermissionRepository.find({
      where: { statementId },
      relations: {
        user: true,
        grantedBy: true,
      },
    });

    const isOwner = statement.userId === userId;
    const userPermission = await this.storageAccess.getUserPermissionForStatement(
      userId,
      statementId,
    );
    const membership = await this.storageAccess.findMembership(statement.workspaceId, userId);
    const isWorkspacePeer = Boolean(membership);
    // A private row reads as a placeholder to all but its owner, here as in the list.
    redactPrivateRows(transactions, membership?.id ?? null);

    const fileAvailability = await this.fileStorageService.getFileAvailability(statement);

    return {
      statement,
      transactions,
      sharedLinks: sharedLinks.map(link => ({
        ...link,
        // Don't expose password hash
        password: link.password ? '******' : null,
      })),
      permissions,
      tags: statement.tags || [],
      isOwner,
      userPermission: isOwner
        ? FilePermissionType.OWNER
        : isWorkspacePeer
          ? FilePermissionType.VIEWER
          : userPermission?.permissionType,
      fileAvailability,
      hasFileOnDisk: fileAvailability.onDisk,
      hasFileInDb: fileAvailability.inDb,
    };
  }
}
