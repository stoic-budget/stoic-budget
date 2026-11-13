import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { canReadPrivate } from '../../../common/utils/transaction-privacy.util';
import type { TransactionCommentEdit } from '../../../contracts';
import {
  ActorType,
  AuditAction,
  type AuditEvent,
  EntityType,
} from '../../../entities/audit-event.entity';
import { WorkspaceMember } from '../../../entities/workspace-member.entity';
import { AuditService } from '../../audit/audit.service';
import { TransactionsService } from '../transactions.service';
import { changesOf, normalize } from './transaction-history-changes';

/**
 * The events that rewrite a comment after the row exists. A rule's is one of
 * them so that a rule writing over a person's comment hides the line again:
 * the text is no longer theirs. Creation and import are never an edit.
 */
const EDITS = new Set([AuditAction.UPDATE, AuditAction.ROLLBACK, AuditAction.APPLY_RULE]);

/**
 * Who last changed a row's comment, from the same audit trail as its History
 * tab. Anyone in the household may rewrite the comment; this only says so.
 */
@Injectable()
export class TransactionCommentEditService {
  constructor(
    private readonly auditService: AuditService,
    private readonly transactionsService: TransactionsService,
    @InjectRepository(WorkspaceMember)
    private readonly memberRepository: Repository<WorkspaceMember>,
  ) {}

  async latest(
    workspaceId: string,
    userId: string,
    transactionId: string,
    viewerMemberId: string | null,
  ): Promise<TransactionCommentEdit> {
    const transaction = await this.transactionsService.findOne(transactionId, workspaceId);
    // Someone else's private row: its comment is hidden, so is who wrote it.
    if (!canReadPrivate(transaction, viewerMemberId)) {
      return { edit: null };
    }
    const events = await this.auditService.findEventsByEntity(
      EntityType.TRANSACTION,
      transactionId,
      workspaceId,
    );
    // Newest first: the first event that touched the comment is the one that counts.
    const last = events
      .filter(event => EDITS.has(event.action))
      .map(event => ({ event, change: changesOf(event).find(item => item.field === 'comment') }))
      .find(item => item.change !== undefined);
    // Some paths rewrite the comment without a trail of it (a rule run on one
    // row, a rollback of an older change, a split): the text is then no longer
    // what that person wrote, so nobody is named for it.
    const stillTheirs =
      last !== undefined && normalize('comment', transaction.comments) === last.change?.after;
    const person =
      last && stillTheirs && last.event.action !== AuditAction.APPLY_RULE
        ? this.personOf(last.event)
        : null;
    if (!(last && person)) {
      return { edit: null };
    }
    const at = last.event.createdAt.toISOString();
    if (person === userId) {
      return { edit: { at, by: 'you', name: null } };
    }
    const member = await this.memberRepository.findOne({
      where: { userId: person, workspaceId },
      relations: { user: true },
    });
    // Gone from the workspace, or never gave a name: "Edited", and never the e-mail.
    return { edit: { at, by: 'member', name: member?.user?.name?.trim() || null } };
  }

  /** The person behind a change, also when they made it through an API key or the assistant. */
  private personOf(event: AuditEvent): string | null {
    if (event.actorType === ActorType.USER) {
      return event.actorId;
    }
    const onBehalfOf = event.meta?.onBehalfOfUserId;
    return typeof onBehalfOf === 'string' ? onBehalfOf : null;
  }
}
