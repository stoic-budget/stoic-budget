import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, type Repository } from 'typeorm';
import { appError } from '../../common/errors/app-error';
import type { CreateFolderBody, StorageViewBody, UpdateFolderBody } from '../../contracts';
import { Folder, Statement, StorageView, Tag } from '../../entities';
import { StatementsService } from '../statements/statements.service';
import { StorageAccessService } from './storage-access.service';

/** Folders, moving a file between them, and saved views of the file list. */
@Injectable()
export class StorageFoldersService {
  constructor(
    @InjectRepository(Folder)
    private readonly folderRepository: Repository<Folder>,
    @InjectRepository(Tag)
    private readonly tagRepository: Repository<Tag>,
    @InjectRepository(Statement)
    private readonly statementRepository: Repository<Statement>,
    @InjectRepository(StorageView)
    private readonly storageViewRepository: Repository<StorageView>,
    private readonly statementsService: StatementsService,
    private readonly storageAccess: StorageAccessService,
  ) {}

  // Folders are the caller's own plus the workspace-wide ones (no owner), matched
  // with IsNull(): TypeORM drops a plain `null` from `where`, so `{ userId: null }`
  // never listed the workspace-wide folders, and `{ id, userId: null }` matched
  // any tenant's folder by id alone.
  private folderScope(workspaceId: string, userId: string, id?: string) {
    const byId = id ? { id } : {};
    return [
      { ...byId, workspaceId, userId },
      { ...byId, workspaceId, userId: IsNull() },
    ];
  }

  async createFolder(dto: CreateFolderBody, userId: string, workspaceId: string) {
    let tag = null;
    const tagId = dto.tagId === '' ? null : dto.tagId;
    if (tagId) {
      // Tags are shared across the workspace (see listTags).
      tag = await this.tagRepository.findOne({ where: { id: tagId, workspaceId } });
      if (!tag) {
        throw new NotFoundException(appError('STORAGE_TAG_NOT_FOUND'));
      }
    }
    const folder = this.folderRepository.create({
      name: dto.name,
      userId,
      workspaceId,
      tagId: tag?.id ?? null,
      tag,
    });
    return await this.folderRepository.save(folder);
  }

  async listFolders(userId: string, workspaceId: string) {
    return await this.folderRepository.find({
      where: this.folderScope(workspaceId, userId),
      order: { name: 'ASC' },
      relations: {
        tag: true,
      },
    });
  }

  async updateFolder(folderId: string, dto: UpdateFolderBody, userId: string, workspaceId: string) {
    const folder = await this.folderRepository.findOne({
      where: { id: folderId, userId, workspaceId },
    });
    if (!folder) {
      throw new NotFoundException(appError('STORAGE_FOLDER_NOT_FOUND'));
    }

    if (dto.name != null) {
      folder.name = dto.name.trim();
    }
    if (dto.tagId !== undefined) {
      const tagId = dto.tagId === '' ? null : dto.tagId;
      if (tagId) {
        const tag = await this.tagRepository.findOne({ where: { id: tagId, workspaceId } });
        if (!tag) {
          throw new NotFoundException(appError('STORAGE_TAG_NOT_FOUND'));
        }
        folder.tagId = tag.id;
        folder.tag = tag;
      } else {
        folder.tagId = null;
        folder.tag = null;
      }
    }

    return await this.folderRepository.save(folder);
  }

  async deleteFolder(folderId: string, userId: string, workspaceId: string, deleteFiles: boolean) {
    const folder = await this.folderRepository.findOne({
      where: { id: folderId, userId, workspaceId },
    });
    if (!folder) {
      throw new NotFoundException(appError('STORAGE_FOLDER_NOT_FOUND'));
    }

    const statements = await this.statementRepository.find({
      where: { folderId: folder.id },
    });

    for (const statement of statements) {
      await this.storageAccess.checkFileAccess(userId, statement.id, 'edit');
    }

    if (deleteFiles) {
      // Files already in the trash stay as they are: trashing them again
      // would restart their 30 days and announce a deletion again.
      for (const statement of statements.filter(item => !item.deletedAt)) {
        await this.statementsService.remove(statement.id, userId, statement.workspaceId);
      }
    } else if (statements.length > 0) {
      await this.statementRepository.update({ folderId: folder.id }, { folderId: null });
    }

    await this.folderRepository.remove(folder);
    return {
      deleted: true,
      filesDeleted: deleteFiles ? statements.length : 0,
    };
  }

  async moveFileToFolder(statementId: string, userId: string, folderId: string | null) {
    await this.storageAccess.checkFileAccess(userId, statementId, 'edit');
    const statement = await this.statementRepository.findOne({
      where: { id: statementId },
    });
    if (!statement) {
      throw new NotFoundException(appError('STORAGE_FILE_NOT_FOUND'));
    }

    let folder: Folder | null = null;
    if (folderId) {
      // Same scoping as listFolders, in the file's own workspace. An unscoped
      // lookup let a file be moved into another tenant's folder.
      folder = await this.folderRepository.findOne({
        where: this.folderScope(statement.workspaceId, userId, folderId),
      });
      if (!folder) {
        throw new NotFoundException(appError('STORAGE_FOLDER_NOT_FOUND'));
      }
    }

    statement.folderId = folder ? folder.id : null;
    statement.folder = folder;
    await this.statementRepository.save(statement);
    return { folderId: statement.folderId };
  }

  async createView(dto: StorageViewBody, userId: string, workspaceId: string) {
    const view = this.storageViewRepository.create({
      name: dto.name,
      userId,
      workspaceId,
      filters: dto.filters || {},
    });
    return await this.storageViewRepository.save(view);
  }

  async listViews(workspaceId: string) {
    return await this.storageViewRepository.find({
      where: { workspaceId },
      order: { createdAt: 'DESC' },
    });
  }

  async deleteView(id: string, workspaceId: string) {
    const view = await this.storageViewRepository.findOne({
      where: { id, workspaceId },
    });
    if (!view) {
      throw new NotFoundException(appError('STORAGE_VIEW_NOT_FOUND'));
    }
    await this.storageViewRepository.remove(view);
    return { deleted: true };
  }
}
