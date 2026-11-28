import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, type Repository } from 'typeorm';
import { appError } from '../../common/errors/app-error';
import { assertRowsRemovable } from '../../common/utils/tax-lock.util';
import { Category, Statement, Tag, Transaction } from '../../entities';
import { StatementsService } from '../statements/statements.service';
import { purgeFromTrash } from './purge-from-trash';
import { StorageAccessService } from './storage-access.service';
import { buildStorageCategoryWhere } from './storage-category-scope.util';

/** A file's category and tags, the trash, and the same actions over many files. */
@Injectable()
export class StorageFileActionsService {
  constructor(
    @InjectRepository(Statement)
    private readonly statementRepository: Repository<Statement>,
    @InjectRepository(Category)
    private readonly categoryRepository: Repository<Category>,
    @InjectRepository(Tag)
    private readonly tagRepository: Repository<Tag>,
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    private readonly statementsService: StatementsService,
    private readonly storageAccess: StorageAccessService,
  ) {}

  /**
   * Update category for a statement (file)
   */
  async updateFileCategory(statementId: string, userId: string, categoryId: string | null) {
    await this.storageAccess.checkFileAccess(userId, statementId, 'edit');

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
    await this.storageAccess.checkFileAccess(userId, statementId, 'edit');
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

  async moveFileToTrash(statementId: string, userId: string) {
    await this.storageAccess.checkFileAccess(userId, statementId, 'edit');
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
    await this.storageAccess.checkFileAccess(userId, statementId, 'edit');
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
    await this.storageAccess.checkFileAccess(userId, statementId, 'edit');
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

  async bulkDelete(statementIds: string[], userId: string) {
    const uniqueIds = Array.from(new Set(statementIds));
    const statements = await this.statementRepository.findBy({
      id: In(uniqueIds),
    });

    if (!statements.length) {
      return { deleted: 0, missing: uniqueIds.length };
    }

    for (const st of statements) {
      await this.storageAccess.checkFileAccess(userId, st.id, 'edit');
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
      await this.storageAccess.checkFileAccess(userId, st.id, 'edit');
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
      await this.storageAccess.checkFileAccess(userId, st.id, 'edit');
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
        await this.storageAccess.checkFileAccess(userId, st.id, 'download');
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
}
