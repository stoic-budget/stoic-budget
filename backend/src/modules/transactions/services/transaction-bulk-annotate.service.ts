import { randomUUID } from 'node:crypto';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Cache } from 'cache-manager';
import { type EntityManager, In, type Repository } from 'typeorm';
import { appError } from '../../../common/errors/app-error';
import { ensureCanEdit } from '../../../common/utils/ensure-can-edit.util';
import { canReadPrivate } from '../../../common/utils/transaction-privacy.util';
import type { BulkAnnotateResult, BulkAnnotateTransactionsBody } from '../../../contracts';
import { ActorType, AuditAction, EntityType } from '../../../entities/audit-event.entity';
import { Tag } from '../../../entities/tag.entity';
import { Transaction } from '../../../entities/transaction.entity';
import { WorkspaceMember } from '../../../entities/workspace-member.entity';
import { AuditService } from '../../audit/audit.service';
import { appendNote, COMMENT_MAX_LENGTH, tagsToAdd } from '../helpers/bulk-annotate-plan';

/** What one row looked like before and after, for its audit entry. */
interface RowChange {
  id: string;
  before: Record<string, unknown>;
  after: Record<string, unknown>;
}

/**
 * Adds tags and a comment to many rows at once, from the selection bar of a
 * list. Additive by design: a tag a row has stays, a comment it has stays and
 * the new one goes after it. All rows change in one database transaction or
 * none do, and each changed row gets its own undoable audit entry under one
 * batch, like the bulk category change.
 */
@Injectable()
export class TransactionBulkAnnotateService {
  constructor(
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    @InjectRepository(WorkspaceMember)
    private readonly workspaceMemberRepository: Repository<WorkspaceMember>,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    private readonly auditService: AuditService,
  ) {}

  async annotate(
    workspaceId: string,
    userId: string,
    body: BulkAnnotateTransactionsBody,
    viewerMemberId: string | null,
  ): Promise<BulkAnnotateResult> {
    // The same check a single edit makes in this workspace.
    await ensureCanEdit(
      this.workspaceMemberRepository,
      workspaceId,
      userId,
      'canEditStatements',
      'STATEMENTS_EDIT_FORBIDDEN',
    );
    const ids = [...new Set(body.ids)];
    const tagIds = [...new Set(body.addTagIds ?? [])];
    const note = body.note?.trim() ?? '';

    let skippedPrivate = 0;
    let skippedTooLong = 0;
    const batchId = ids.length > 1 ? randomUUID() : null;
    const changes = await this.transactionRepository.manager.transaction(async manager => {
      await this.assertTagsInWorkspace(manager, workspaceId, tagIds);
      const rows = await this.lockRows(manager, workspaceId, ids);
      const current = await this.currentTags(manager, ids);
      const changed: RowChange[] = [];

      for (const row of rows) {
        const had = current.get(row.id) ?? [];
        const added = tagsToAdd(had, tagIds);
        // Another member's private row: its comment is theirs to read and so to
        // write. Appending blind would also make "already there" a yes/no
        // answer about text the caller cannot see.
        const readable = canReadPrivate(row, viewerMemberId);
        if (note && !readable) {
          skippedPrivate += 1;
        }
        let comment = note && readable ? appendNote(row.comments, note) : null;
        // The comment field takes 1000 characters; a longer one could not be edited by hand.
        if (comment !== null && comment.length > COMMENT_MAX_LENGTH) {
          skippedTooLong += 1;
          comment = null;
        }
        if (added.length === 0 && comment === null) {
          continue;
        }

        const before: Record<string, unknown> = {};
        const after: Record<string, unknown> = {};
        if (added.length > 0) {
          // The primary key (transaction_id, tag_id) makes a link that is
          // already there a no-op, whatever runs beside this request.
          await manager.query(
            `INSERT INTO transaction_tags (transaction_id, tag_id)
             SELECT $1, unnest($2::uuid[])
             ON CONFLICT DO NOTHING`,
            [row.id, added],
          );
          before.tagIds = had;
          after.tagIds = [...had, ...added];
        }
        if (comment !== null) {
          await manager.update(Transaction, { id: row.id, workspaceId }, { comments: comment });
          before.comments = row.comments;
          after.comments = comment;
        }
        changed.push({ id: row.id, before, after });
      }
      // In the same transaction: no change is kept without the entry that undoes it.
      await this.audit(manager, workspaceId, userId, changed, batchId);
      return changed;
    });

    if (changes.length > 0) {
      // Reports are cached per workspace version; tags feed the By tag figures.
      await this.cacheManager.set(`reports:version:${workspaceId}`, Date.now().toString(), 0);
    }
    return { updated: changes.length, skippedPrivate, skippedTooLong };
  }

  /** Another workspace's tag reads as a missing one, so its existence is not given away. */
  private async assertTagsInWorkspace(
    manager: EntityManager,
    workspaceId: string,
    tagIds: string[],
  ): Promise<void> {
    if (tagIds.length === 0) {
      return;
    }
    const found = await manager.count(Tag, { where: { id: In(tagIds), workspaceId } });
    if (found !== tagIds.length) {
      throw new BadRequestException(appError('TRANSACTION_TAGS_NOT_FOUND'));
    }
  }

  /**
   * The rows, locked until the transaction ends, in id order so two requests
   * over overlapping selections queue instead of deadlocking. The second of
   * two identical requests then reads what the first wrote and changes nothing.
   */
  private async lockRows(
    manager: EntityManager,
    workspaceId: string,
    ids: string[],
  ): Promise<Transaction[]> {
    const rows = await manager
      .getRepository(Transaction)
      .createQueryBuilder('transaction')
      .select([
        'transaction.id',
        'transaction.comments',
        'transaction.isPrivate',
        'transaction.ownerMemberId',
      ])
      .where('transaction.workspaceId = :workspaceId', { workspaceId })
      .andWhere('transaction.id IN (:...ids)', { ids })
      .orderBy('transaction.id', 'ASC')
      .setLock('pessimistic_write')
      .getMany();
    // One unknown id (or one of another workspace) refuses the whole request.
    if (rows.length !== ids.length) {
      throw new NotFoundException(appError('TRANSACTION_NOT_FOUND'));
    }
    return rows;
  }

  private async currentTags(manager: EntityManager, ids: string[]): Promise<Map<string, string[]>> {
    const links: Array<{ transaction_id: string; tag_id: string }> = await manager.query(
      'SELECT transaction_id, tag_id FROM transaction_tags WHERE transaction_id = ANY($1::uuid[])',
      [ids],
    );
    const byRow = new Map<string, string[]>();
    for (const link of links) {
      byRow.set(link.transaction_id, [...(byRow.get(link.transaction_id) ?? []), link.tag_id]);
    }
    return byRow;
  }

  /** One entry per changed row; undo removes the tags it added and puts the old comment back. */
  private async audit(
    manager: EntityManager,
    workspaceId: string,
    userId: string,
    changes: RowChange[],
    batchId: string | null,
  ): Promise<void> {
    // The first entry looks the actor's label up; the rest reuse it.
    let actorLabel: string | undefined;
    for (const change of changes) {
      const saved = await this.auditService.createEvent(
        {
          workspaceId,
          actorType: ActorType.USER,
          actorId: userId,
          entityType: EntityType.TRANSACTION,
          entityId: change.id,
          action: AuditAction.UPDATE,
          diff: { before: change.before, after: change.after },
          meta: { updatedFields: Object.keys(change.after), bulk: 'annotate' },
          batchId,
          isUndoable: true,
          actorLabel,
        },
        manager,
      );
      actorLabel = saved.actorLabel;
    }
  }
}
