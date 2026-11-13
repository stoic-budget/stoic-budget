import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, type Repository } from 'typeorm';
import { appError } from '../../../common/errors/app-error';
import { ensureCanEdit } from '../../../common/utils/ensure-can-edit.util';
import { ActorType, AuditAction, EntityType } from '../../../entities/audit-event.entity';
import { Tag } from '../../../entities/tag.entity';
import { WorkspaceMember } from '../../../entities/workspace-member.entity';
import { AuditService } from '../../audit/audit.service';
import { currentTagIds, restoreTagSet, tagSetIds, tagSetKey } from '../helpers/tag-set-restore';
import type { RawChange } from './transaction-history-changes';

/**
 * The tag side of a row's History: tags are links, not a column, so they are
 * read, named and put back here rather than through the ordinary update.
 */
@Injectable()
export class TransactionTagHistoryService {
  constructor(
    @InjectRepository(Tag) private readonly tagRepository: Repository<Tag>,
    @InjectRepository(WorkspaceMember)
    private readonly memberRepository: Repository<WorkspaceMember>,
    private readonly auditService: AuditService,
  ) {}

  /** The row's tags now, as the history compares them. */
  async tagKey(transactionId: string): Promise<string | null> {
    return tagSetKey(await currentTagIds(this.tagRepository.manager, transactionId));
  }

  /** Names for tag ids of this workspace; a deleted tag has none. */
  async names(workspaceId: string, ids: string[]): Promise<Map<string, string>> {
    const tags = ids.length
      ? await this.tagRepository.find({ where: { id: In(ids), workspaceId } })
      : [];
    return new Map(tags.map(tag => [tag.id, tag.name]));
  }

  /**
   * Puts the row's tags back to what they were before the change, locked, and
   * audits it like the bulk add (so it can be put back in turn). Refused when
   * the row no longer carries what the change wrote.
   */
  async undo(
    workspaceId: string,
    userId: string,
    transactionId: string,
    change: RawChange,
  ): Promise<void> {
    // The same check a single edit makes in this workspace.
    await ensureCanEdit(
      this.memberRepository,
      workspaceId,
      userId,
      'canEditStatements',
      'STATEMENTS_EDIT_FORBIDDEN',
    );
    await this.tagRepository.manager.transaction(async manager => {
      const set = await restoreTagSet(
        manager,
        transactionId,
        workspaceId,
        tagSetIds(change.before),
        tagSetIds(change.after),
      );
      if (!set) {
        throw new ConflictException(appError('TRANSACTION_CHANGE_NOT_UNDOABLE'));
      }
      await this.auditService.createEvent(
        {
          workspaceId,
          actorType: ActorType.USER,
          actorId: userId,
          entityType: EntityType.TRANSACTION,
          entityId: transactionId,
          action: AuditAction.UPDATE,
          diff: { before: { tagIds: set.was }, after: { tagIds: set.now } },
          meta: { updatedFields: ['tagIds'], bulk: 'annotate' },
          isUndoable: true,
        },
        manager,
      );
    });
  }
}
