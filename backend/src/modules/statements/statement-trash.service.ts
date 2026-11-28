import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Cache } from 'cache-manager';
import { In, Not, type Repository } from 'typeorm';
import { appError } from '../../common/errors/app-error';
import { FileStorageService } from '../../common/services/file-storage.service';
import { assertRowsRemovable } from '../../common/utils/tax-lock.util';
import { WorkspaceMember } from '../../entities';
import { ActorType, AuditAction, EntityType, Severity } from '../../entities/audit-event.entity';
import { Statement } from '../../entities/statement.entity';
import { Transaction } from '../../entities/transaction.entity';
import { AuditService } from '../audit/audit.service';
import type { DataDeletedEvent } from '../notifications/events/notification-events';
import { ensureCanModifyStatement } from './statement-access';
import { removeStatementFile } from './statement-file-removal.util';

/**
 * A document's way out and back: into the trash (its rows drop out of every
 * total), out of it again, or deleted for good with its rows and file. A row
 * on a filed tax return keeps its document where it is.
 */
@Injectable()
export class StatementTrashService {
  private readonly logger = new Logger(StatementTrashService.name);

  constructor(
    @InjectRepository(Statement)
    private readonly statementRepository: Repository<Statement>,
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    @InjectRepository(WorkspaceMember)
    private readonly workspaceMemberRepository: Repository<WorkspaceMember>,
    private readonly fileStorageService: FileStorageService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    private readonly auditService: AuditService,
    private readonly eventEmitter?: EventEmitter2,
  ) {}

  async trash(statement: Statement, userId: string, workspaceId: string): Promise<Statement> {
    await ensureCanModifyStatement(this.workspaceMemberRepository, statement, userId, workspaceId);
    // A trashed statement's rows drop out of every total, including the
    // filed return they were reported on.
    await assertRowsRemovable(this.transactionRepository, {
      statementId: statement.id,
      workspaceId,
    });

    // Mark as deleted (soft delete)
    const beforeState = { ...statement };
    statement.deletedAt = new Date();
    await this.statementRepository.save(statement);

    // Audit: record statement deletion with before snapshot.
    await this.auditService.createEvent({
      workspaceId,
      actorType: ActorType.USER,
      actorId: userId,
      entityType: EntityType.STATEMENT,
      entityId: statement.id,
      action: AuditAction.DELETE,
      diff: { before: beforeState, after: null },
      meta: {
        fileName: statement.fileName,
        source: 'trash',
      },
      isUndoable: true,
    });

    this.eventEmitter?.emit('data.deleted', {
      workspaceId,
      actorId: userId,
      actorName: statement.user?.name || statement.user?.email || 'User',
      entityType: 'statement',
      entityLabel: statement.fileName,
      count: 1,
    } satisfies DataDeletedEvent);

    return statement;
  }

  /**
   * Deletes a statement for good: its rows, the file once nothing else reads
   * it, and the statement. `fromTrash` refuses one that is no longer in the
   * trash (restored meanwhile); `system` is the nightly purge, which acts for
   * the workspace and not as the uploader, whose rights may have changed.
   */
  async permanentDelete(
    id: string,
    userId: string,
    workspaceId: string,
    options: { fromTrash?: boolean; system?: boolean } = {},
  ): Promise<void> {
    const statement = await this.statementRepository.findOne({
      where: { id, workspaceId },
      relations: {
        user: true,
      },
    });

    if (!statement) {
      throw new NotFoundException(appError('STATEMENT_NOT_FOUND'));
    }
    if (!options.system) {
      await ensureCanModifyStatement(
        this.workspaceMemberRepository,
        statement,
        userId,
        workspaceId,
      );
    }

    // One transaction with the statement row locked: a restore, a second
    // delete or the purge at the same moment waits, then finds it gone.
    await this.statementRepository.manager.transaction(async manager => {
      const statements = manager.getRepository(Statement);
      const transactions = manager.getRepository(Transaction);
      const locked = await statements.findOne({
        where: { id, workspaceId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!locked) {
        throw new NotFoundException(appError('STATEMENT_NOT_FOUND'));
      }
      if (options.fromTrash && !locked.deletedAt) {
        throw new BadRequestException(appError('STORAGE_FILE_NOT_IN_TRASH'));
      }
      await assertRowsRemovable(transactions, { statementId: id, workspaceId });
      await unflagCopiesOf(transactions, id, workspaceId);
      await transactions.delete({ statementId: id });
      await statements.delete({ id, workspaceId });
    });

    // Not undoable: the rows and the file are gone, an undo would bring back
    // an empty statement.
    await this.auditService.createEvent({
      workspaceId,
      actorType: options.system ? ActorType.SYSTEM : ActorType.USER,
      actorId: options.system ? null : userId,
      entityType: EntityType.STATEMENT,
      entityId: statement.id,
      action: AuditAction.DELETE,
      diff: { before: { ...statement }, after: null },
      meta: {
        fileName: statement.fileName,
        source: options.system ? 'trash-purge' : 'permanent',
      },
      isUndoable: false,
    });

    this.eventEmitter?.emit('data.deleted', {
      workspaceId,
      actorId: userId,
      actorName: statement.user?.name || statement.user?.email || 'User',
      entityType: 'statement',
      entityLabel: statement.fileName,
      count: 1,
    } satisfies DataDeletedEvent);

    await removeStatementFile(this.statementRepository, statement, this.logger);

    // Invalidate thumbnail cache
    await this.cacheManager.del(`statements:thumbnail:${id}`);
  }

  async restore(id: string, userId: string, workspaceId: string) {
    const statement = await this.statementRepository.findOne({
      where: { id, workspaceId },
      relations: {
        user: true,
      },
    });

    if (!statement) {
      throw new NotFoundException(appError('STATEMENT_NOT_FOUND'));
    }

    await ensureCanModifyStatement(this.workspaceMemberRepository, statement, userId, workspaceId);

    // If the file is in trash, restore it from trash
    if (statement.deletedAt) {
      statement.deletedAt = null;
      await this.statementRepository.save(statement);

      // Audit: record permanent removal (used for hard delete flow).
      await this.auditService.createEvent({
        workspaceId,
        actorType: ActorType.USER,
        actorId: userId,
        entityType: EntityType.STATEMENT,
        entityId: statement.id,
        action: AuditAction.ROLLBACK,
        diff: { before: null, after: statement },
        meta: {
          source: 'trash_restore',
        },
        severity: Severity.INFO,
        isUndoable: false,
      });

      return { status: 'restored', source: 'trash' };
    }

    // Otherwise, restore file from database if it's missing from disk
    const restored = await this.fileStorageService.restoreFile(statement);
    if (!restored) {
      throw new NotFoundException(appError('STATEMENT_FILE_RESTORE_UNAVAILABLE'));
    }
    return { status: 'restored', source: restored.source };
  }
}

/**
 * Copies of the statement's rows in other statements stand alone again: with
 * their original gone they would stay out of every total for good, and Review
 * cannot settle a duplicate whose original is missing.
 */
async function unflagCopiesOf(
  transactions: Repository<Transaction>,
  statementId: string,
  workspaceId: string,
): Promise<void> {
  const ids = (
    await transactions.find({ where: { statementId, workspaceId }, select: { id: true } })
  ).map(row => row.id);
  if (ids.length === 0) {
    return;
  }
  await transactions.update(
    { workspaceId, duplicateOfId: In(ids), id: Not(In(ids)) },
    {
      isDuplicate: false,
      duplicateOfId: null,
      duplicateConfidence: null,
      duplicateMatchType: null,
    },
  );
}
