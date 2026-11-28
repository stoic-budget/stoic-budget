import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import * as fs from 'fs';
import { In, IsNull, type Repository } from 'typeorm';
import { toEnum } from '../../common/effect/to-enum';
import { appError } from '../../common/errors/app-error';
import { FileStorageService } from '../../common/services/file-storage.service';
import { hashPassword } from '../../common/utils/password-hash.util';
import { neutralizeSpreadsheetFormulaCell } from '../../common/utils/spreadsheet-formula.util';
import { assertRowsRemovable } from '../../common/utils/tax-lock.util';
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
  Category,
  FilePermission,
  FilePermissionType,
  FileVersion,
  SharedLink,
  ShareLinkStatus,
  SharePermissionLevel,
  Statement,
  Tag,
  Transaction,
  WorkspaceMember,
} from '../../entities';
import { MetricsService } from '../observability/metrics.service';
import { StatementsService } from '../statements/statements.service';
import type { StorageViewFilters } from './interfaces/storage-view-filters.interface';
import { purgeFromTrash } from './purge-from-trash';
import { StorageAccessService, type StorageAction } from './storage-access.service';
import { buildStorageCategoryWhere } from './storage-category-scope.util';
import { StorageFilesQueryService } from './storage-files-query.service';
import { StorageFoldersService } from './storage-folders.service';

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
    @InjectRepository(FileVersion)
    private readonly fileVersionRepository: Repository<FileVersion>,
    @InjectRepository(Tag)
    private readonly tagRepository: Repository<Tag>,
    @InjectRepository(WorkspaceMember)
    private readonly workspaceMemberRepository: Repository<WorkspaceMember>,
    private readonly fileStorageService: FileStorageService,
    private readonly statementsService: StatementsService,
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    @InjectRepository(Category)
    private readonly categoryRepository: Repository<Category>,
    private readonly storageAccess: StorageAccessService,
    private readonly storageFilesQuery: StorageFilesQueryService,
    private readonly storageFolders: StorageFoldersService,
    @Optional()
    private readonly metricsService?: MetricsService,
  ) {}

  getStorageFiles(userId: string, workspaceId: string, filters?: StorageViewFilters) {
    return this.storageFilesQuery.getStorageFiles(userId, workspaceId, filters);
  }

  getFileDetails(statementId: string, userId: string) {
    return this.storageFilesQuery.getFileDetails(statementId, userId);
  }

  /**
   * Update category for a statement (file)
   */
  async updateFileCategory(statementId: string, userId: string, categoryId: string | null) {
    await this.checkFileAccess(userId, statementId, 'edit');

    const statement = await this.statementRepository.findOne({
      where: { id: statementId },
      relations: {
        category: true,
      },
    });

    if (!statement) {
      throw new NotFoundException(appError('STORAGE_FILE_NOT_FOUND'));
    }

    let category: Category | null = null;
    if (categoryId) {
      category = await this.categoryRepository.findOne({
        where: buildStorageCategoryWhere(categoryId, statement.userId, statement.workspaceId),
      });

      if (!category) {
        throw new NotFoundException(appError('CATEGORY_NOT_FOUND'));
      }
    }

    statement.categoryId = category ? category.id : null;
    statement.category = category;

    const saved = await this.statementRepository.save(statement);

    // Only what changed: the whole row would hand out the server path and the file hash.
    return { id: saved.id, categoryId: saved.categoryId, category };
  }

  async updateFileTags(statementId: string, userId: string, tagIds: string[]) {
    await this.checkFileAccess(userId, statementId, 'edit');
    const statement = await this.statementRepository.findOne({
      where: { id: statementId },
      relations: {
        tags: true,
      },
    });
    if (!statement) {
      throw new NotFoundException(appError('STORAGE_FILE_NOT_FOUND'));
    }

    // Ids from the request: only the file's own workspace's tags exist for it.
    const uniqueTagIds = [...new Set(tagIds)];
    const tags = uniqueTagIds.length
      ? await this.tagRepository.findBy({
          id: In(uniqueTagIds),
          workspaceId: statement.workspaceId ?? IsNull(),
        })
      : [];
    if (tags.length !== uniqueTagIds.length) {
      throw new NotFoundException(appError('STORAGE_TAG_NOT_FOUND'));
    }
    statement.tags = tags;
    const saved = await this.statementRepository.save(statement);
    return { ...saved, tags };
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

  async moveFileToTrash(statementId: string, userId: string) {
    await this.checkFileAccess(userId, statementId, 'edit');
    const statement = await this.statementRepository.findOne({
      where: { id: statementId },
    });
    if (!statement) {
      throw new NotFoundException(appError('STORAGE_FILE_NOT_FOUND'));
    }
    if (statement.deletedAt) {
      return { status: 'already_trashed', deletedAt: statement.deletedAt };
    }
    statement.deletedAt = new Date();
    await this.statementRepository.save(statement);
    return { status: 'trashed', deletedAt: statement.deletedAt };
  }

  async restoreFileFromTrash(statementId: string, userId: string) {
    await this.checkFileAccess(userId, statementId, 'edit');
    const statement = await this.statementRepository.findOne({
      where: { id: statementId },
    });
    if (!statement) {
      throw new NotFoundException(appError('STORAGE_FILE_NOT_FOUND'));
    }
    if (!statement.deletedAt) {
      return { status: 'active' };
    }
    statement.deletedAt = null;
    await this.statementRepository.save(statement);
    return { status: 'restored' };
  }

  async deleteFilePermanently(statementId: string, userId: string) {
    await this.checkFileAccess(userId, statementId, 'edit');
    const statement = await this.statementRepository.findOne({
      where: { id: statementId },
    });
    if (!statement) {
      throw new NotFoundException(appError('STORAGE_FILE_NOT_FOUND'));
    }
    if (!statement.deletedAt) {
      throw new BadRequestException(appError('STORAGE_FILE_NOT_IN_TRASH'));
    }
    // Out of the trash for good: the rows and the file go (remove only trashes).
    await purgeFromTrash(this.statementsService, this.transactionRepository, [statement], userId);
    return { status: 'deleted' };
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

  async createFileVersion(statementId: string, userId: string) {
    await this.checkFileAccess(userId, statementId, 'edit');

    const statement = await this.statementRepository
      .createQueryBuilder('statement')
      .addSelect('statement.fileData')
      .where('statement.id = :id', { id: statementId })
      .getOne();

    if (!statement) {
      throw new NotFoundException(appError('STORAGE_FILE_NOT_FOUND'));
    }

    let fileData = statement.fileData ?? null;

    if (!fileData) {
      const resolved = this.fileStorageService.resolveFilePath(statement.filePath);
      if (resolved) {
        try {
          fileData = await fs.promises.readFile(resolved);
        } catch {
          fileData = null;
        }
      }
    }

    if (!fileData && statement.fileHash && statement.userId) {
      const other = await this.statementRepository
        .createQueryBuilder('statement')
        .addSelect('statement.fileData')
        .where('statement.userId = :userId', { userId: statement.userId })
        .andWhere('statement.fileHash = :fileHash', {
          fileHash: statement.fileHash,
        })
        .andWhere('statement.fileData IS NOT NULL')
        .andWhere('statement.id <> :id', { id: statement.id })
        .orderBy('statement.createdAt', 'DESC')
        .getOne();

      fileData = other?.fileData ?? null;
    }

    if (!fileData) {
      throw new NotFoundException(appError('STORAGE_FILE_DATA_UNAVAILABLE_VERSIONING'));
    }

    const actualHash = crypto.createHash('sha256').update(fileData).digest('hex');
    if (actualHash !== statement.fileHash) {
      throw new BadRequestException(appError('STORAGE_FILE_HASH_MISMATCH'));
    }

    const version = this.fileVersionRepository.create({
      statementId: statement.id,
      createdBy: userId,
      fileHash: statement.fileHash,
      fileName: statement.fileName,
      fileType: statement.fileType,
      fileSize: statement.fileSize,
      fileData,
    });

    const saved = await this.fileVersionRepository.save(version);

    return {
      id: saved.id,
      statementId: saved.statementId,
      createdBy: saved.createdBy,
      fileHash: saved.fileHash,
      fileName: saved.fileName,
      fileType: saved.fileType,
      // bigint: the version list answers it as a string, so this answers the same.
      fileSize: String(saved.fileSize),
      createdAt: saved.createdAt,
    };
  }

  async listFileVersions(statementId: string, userId: string) {
    await this.checkFileAccess(userId, statementId, 'view');

    return await this.fileVersionRepository.find({
      where: { statementId },
      order: { createdAt: 'DESC' },
      select: {
        id: true,
        statementId: true,
        createdBy: true,
        fileHash: true,
        fileName: true,
        fileType: true,
        fileSize: true,
        createdAt: true,
      },
    });
  }

  /**
   * Download file
   */
  async downloadFile(statementId: string, userId: string) {
    const statement = await this.statementRepository.findOne({
      where: { id: statementId },
    });

    if (!statement) {
      throw new NotFoundException(appError('STORAGE_FILE_NOT_FOUND'));
    }

    const { stream, fileName, mimeType } = await this.getFileStream(statement, userId, 'download');
    return { stream, fileName, mimeType };
  }

  async restoreFile(statementId: string, userId: string) {
    await this.checkFileAccess(userId, statementId, 'edit');
    const statement = await this.statementRepository.findOne({
      where: { id: statementId },
    });
    if (!statement) {
      throw new NotFoundException(appError('STORAGE_FILE_NOT_FOUND'));
    }
    const restored = await this.fileStorageService.restoreFile(statement);
    if (!restored) {
      throw new NotFoundException(appError('STORAGE_FILE_DATA_UNAVAILABLE_RESTORE'));
    }
    return { status: 'restored', source: restored.source };
  }

  async exportTransactionsCsv(statementId: string, userId: string) {
    await this.checkFileAccess(userId, statementId, 'view');
    const transactions = await this.transactionRepository.find({
      where: { statementId },
      order: { transactionDate: 'DESC' },
    });
    // As in getFileDetails: a private row reads as a placeholder to all but its owner.
    const workspaceId = transactions[0]?.workspaceId;
    const membership = workspaceId
      ? await this.storageAccess.findMembership(workspaceId, userId)
      : null;
    redactPrivateRows(transactions, membership?.id ?? null);

    const header = [
      'date',
      'documentNumber',
      'counterpartyName',
      'counterpartyBin',
      'debit',
      'credit',
      'currency',
      'paymentPurpose',
    ];
    const rows = transactions.map(t => [
      // The `date` column comes back as a string, not a Date.
      t.transactionDate ? new Date(t.transactionDate).toISOString().split('T')[0] : '',
      t.documentNumber ?? '',
      t.counterpartyName ?? '',
      t.counterpartyBin ?? '',
      t.debit ?? '',
      t.credit ?? '',
      t.currency ?? '',
      (t.paymentPurpose || '').replace(/\n/g, ' '),
    ]);
    const csv = [header, ...rows]
      .map(r =>
        r
          .map(v => `"${String(neutralizeSpreadsheetFormulaCell(v)).replace(/"/g, '""')}"`)
          .join(','),
      )
      .join('\n');
    const fileName = `transactions-${statementId}.csv`;
    return { csv, fileName };
  }

  async bulkDelete(statementIds: string[], userId: string) {
    const uniqueIds = Array.from(new Set(statementIds));
    const statements = await this.statementRepository.findBy({
      id: In(uniqueIds),
    });

    if (!statements.length) {
      return { deleted: 0, missing: uniqueIds.length };
    }

    for (const st of statements) {
      await this.checkFileAccess(userId, st.id, 'edit');
    }

    // The same path as deleting one file: to the trash, audited, and refused
    // for rows on a filed tax return — checked for all first, so a refusal
    // leaves none trashed. Files already in the trash stay as they are.
    const toTrash = statements.filter(item => !item.deletedAt);
    if (toTrash.length) {
      await assertRowsRemovable(this.transactionRepository, {
        statementId: In(toTrash.map(st => st.id)),
      });
    }
    for (const st of toTrash) {
      await this.statementsService.remove(st.id, userId, st.workspaceId);
    }
    return {
      deleted: statements.length,
      missing: uniqueIds.length - statements.length,
    };
  }

  async bulkRestoreFromTrash(statementIds: string[], userId: string) {
    const uniqueIds = Array.from(new Set(statementIds));
    const statements = await this.statementRepository.findBy({
      id: In(uniqueIds),
    });

    if (!statements.length) {
      return { restored: 0, missing: uniqueIds.length };
    }

    for (const st of statements) {
      await this.checkFileAccess(userId, st.id, 'edit');
    }

    const restoreIds = statements.filter(st => st.deletedAt).map(st => st.id);

    if (restoreIds.length) {
      await this.statementRepository.update({ id: In(restoreIds) }, { deletedAt: null });
    }

    return {
      restored: restoreIds.length,
      missing: uniqueIds.length - statements.length,
      skipped: statements.length - restoreIds.length,
    };
  }

  async bulkDeleteFromTrash(statementIds: string[], userId: string) {
    const uniqueIds = Array.from(new Set(statementIds));
    const statements = await this.statementRepository.findBy({
      id: In(uniqueIds),
    });

    if (!statements.length) {
      return { deleted: 0, missing: uniqueIds.length };
    }

    for (const st of statements) {
      await this.checkFileAccess(userId, st.id, 'edit');
    }

    const deletable = statements.filter(st => st.deletedAt);
    await purgeFromTrash(this.statementsService, this.transactionRepository, deletable, userId);
    return {
      deleted: deletable.length,
      missing: uniqueIds.length - statements.length,
      skipped: statements.length - deletable.length,
    };
  }

  async bulkDownload(statementIds: string[], userId: string) {
    const uniqueIds = Array.from(new Set(statementIds));
    const statements = await this.statementRepository.findBy({
      id: In(uniqueIds),
    });
    const allowed: { id: string; downloadUrl: string }[] = [];
    for (const st of statements) {
      try {
        await this.checkFileAccess(userId, st.id, 'download');
        const base =
          process.env.API_BASE_URL || process.env.BACKEND_URL || 'http://localhost:3001/api/v1';
        allowed.push({
          id: st.id,
          downloadUrl: `${base}/storage/files/${st.id}/download`,
        });
      } catch {
        // skip not allowed
      }
    }
    return {
      files: allowed,
      requested: uniqueIds.length,
      allowed: allowed.length,
    };
  }

  /**
   * Get file info for inline preview
   */
  async getFilePreview(statementId: string, userId: string) {
    const statement = await this.statementRepository.findOne({
      where: { id: statementId },
    });

    if (!statement) {
      throw new NotFoundException(appError('STORAGE_FILE_NOT_FOUND'));
    }

    const started = Date.now();
    try {
      const { stream, fileName, mimeType } = await this.getFileStream(statement, userId, 'view');
      return { stream, fileName, mimeType };
    } catch (error) {
      this.observeFileAccess('view', 'error', started);
      throw error;
    }
  }

  async getSharedDownloadStream(statementId: string): Promise<{
    stream: NodeJS.ReadableStream;
    fileName: string;
    mimeType: string;
  }> {
    const statement = await this.statementRepository.findOne({
      where: { id: statementId },
    });

    if (!statement) {
      throw new NotFoundException(appError('STORAGE_FILE_NOT_FOUND'));
    }

    const started = Date.now();
    try {
      const { stream, fileName, mimeType, source } =
        await this.fileStorageService.getStatementFileStream(statement);
      this.observeFileAccess('shared-download', 'ok', started, source);
      return { stream, fileName, mimeType };
    } catch (error) {
      this.observeFileAccess('shared-download', 'error', started);
      throw error;
    }
  }

  private async getFileStream(
    statement: Statement,
    userId: string,
    action: 'view' | 'download',
  ): Promise<{
    stream: NodeJS.ReadableStream;
    fileName: string;
    mimeType: string;
  }> {
    await this.checkFileAccess(userId, statement.id, action);

    const started = Date.now();
    try {
      const { stream, fileName, mimeType, source } =
        await this.fileStorageService.getStatementFileStream(statement);
      this.observeFileAccess(action, 'ok', started, source);
      return { stream, fileName, mimeType };
    } catch (error) {
      this.observeFileAccess(action, 'error', started);
      throw error;
    }
  }

  private observeFileAccess(
    action: 'view' | 'download' | 'shared-download',
    result: 'ok' | 'error',
    startedAt: number,
    source: 'disk' | 'db' | 'restored' | 'unknown' = 'unknown',
  ) {
    if (!this.metricsService?.storageFileAccessDurationSeconds) {
      return;
    }
    const duration = (Date.now() - startedAt) / 1000;
    this.metricsService.storageFileAccessDurationSeconds.observe(
      { action, source, result },
      duration,
    );
    if (result === 'error' && this.metricsService.storageFileAccessErrorsTotal) {
      this.metricsService.storageFileAccessErrorsTotal.inc({
        action,
        reason: 'access_failed',
      });
    }
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
