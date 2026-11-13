import { randomUUID } from 'node:crypto';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Cache } from 'cache-manager';
import { type EntityManager, In, type Repository } from 'typeorm';
import { appError } from '../../../common/errors/app-error';
import { ensureCanEdit } from '../../../common/utils/ensure-can-edit.util';
import { taxLockedConflict } from '../../../common/utils/tax-lock.util';
import { ActorType, AuditAction, EntityType } from '../../../entities/audit-event.entity';
import { Transaction } from '../../../entities/transaction.entity';
import { User } from '../../../entities/user.entity';
import { WorkspaceMember } from '../../../entities/workspace-member.entity';
import { AuditService } from '../../audit/audit.service';
import type { DataDeletedEvent } from '../../notifications/events/notification-events';
import { recountStatementTotals } from '../../statements/helpers/statement-totals';
import {
  type DeletedRowLinks,
  deleteAndDetach,
  linksOf,
  lockDeleteClosure,
} from '../helpers/transaction-delete-links';

type RemovedRow = { row: Transaction; links: DeletedRowLinks };

/**
 * Deleting transactions, one (`DELETE /transactions/:id`) or many
 * (`POST /transactions/bulk-delete`): both routes go through `remove`, so a
 * bulk delete is exactly a run of single deletes, only all or nothing.
 *
 * What hangs on a deleted row is kept true here, not left to the foreign keys:
 * - the other leg of a transfer or full reimbursement is released, or it stays
 *   out of every income and spending figure with no partner to explain it;
 * - a row flagged as a duplicate of a deleted one is unflagged, or the charge
 *   disappears from the books with its master (and Review cannot settle a
 *   duplicate whose master is gone);
 * - the last part left of a split is a plain row again, as unsplit leaves it;
 * - the statements of the deleted rows are recounted from their rows.
 * Each row's audit entry records those links (`DeletedRowLinks`); undoing that
 * entry (RollbackService, one row at a time) puts them back.
 *
 * Everything else that hangs on a row follows its foreign key and is NOT put
 * back by an undo: tags, attachments, notes, goal contributions, subscription
 * charges and item images are deleted with it (CASCADE); receipts, payables,
 * payable payments and ledger entries lose the link (SET NULL), and the ledger
 * sync reverses the orphaned postings.
 */
@Injectable()
export class TransactionDeleteService {
  constructor(
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(WorkspaceMember)
    private readonly workspaceMemberRepository: Repository<WorkspaceMember>,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    private readonly auditService: AuditService,
    @Optional() private readonly eventEmitter?: EventEmitter2,
  ) {}

  /**
   * Deletes the given rows of the workspace and answers how many went.
   *
   * Every id must be a row of this workspace: one that is not (gone, never
   * there, or another workspace's) refuses the whole request with the same
   * "not found" either way, and nothing is deleted.
   */
  async remove(ids: readonly string[], workspaceId: string, userId: string): Promise<number> {
    await ensureCanEdit(
      this.workspaceMemberRepository,
      workspaceId,
      userId,
      'canEditStatements',
      'STATEMENTS_EDIT_FORBIDDEN',
    );
    const unique = [...new Set(ids)];

    const removed = await this.transactionRepository.manager.transaction(manager =>
      this.deleteRows(manager, unique, workspaceId),
    );

    await this.cacheManager.set(`reports:version:${workspaceId}`, Date.now().toString(), 0);

    // One batch id, so the activity log shows the delete as one step; undo is per row.
    const batchId = removed.length > 1 ? randomUUID() : null;
    for (const { row: transaction, links } of removed) {
      // Audit: record deletion for potential rollback, with what the delete
      // took apart around the row, so undo can put exactly that back.
      await this.auditService.createEvent({
        workspaceId,
        actorType: ActorType.USER,
        actorId: userId,
        entityType: EntityType.TRANSACTION,
        entityId: transaction.id,
        action: AuditAction.DELETE,
        diff: { before: transaction, after: null },
        meta: { statementId: transaction.statementId, links },
        batchId,
        isUndoable: true,
      });
    }

    // One notice for the lot. It names the row only when there is one, and
    // never a private one: every member gets the notice, the merchant is the owner's.
    const only = removed[0]?.row;
    const label =
      removed.length === 1 && only && !only.isPrivate
        ? only.documentNumber || only.counterpartyName
        : undefined;
    this.eventEmitter?.emit('data.deleted', {
      workspaceId,
      actorId: userId,
      actorName: await this.resolveActorName(userId),
      entityType: 'transaction',
      entityLabel: label,
      count: removed.length,
    } satisfies DataDeletedEvent);

    return removed.length;
  }

  private async deleteRows(
    manager: EntityManager,
    ids: string[],
    workspaceId: string,
  ): Promise<RemovedRow[]> {
    const repo = manager.getRepository(Transaction);

    // The same request sent twice queues here, and the second one then finds
    // the rows gone instead of deleting twice. Two deletes touching each
    // other's partners queue too: the whole closure is locked in id order.
    const closure = await lockDeleteClosure(manager, workspaceId, ids);
    const targets = closure.filter(row => ids.includes(row.id));
    if (targets.length !== ids.length) {
      throw new NotFoundException(appError('TRANSACTION_NOT_FOUND'));
    }

    const taxLocked = await repo.count({ where: { workspaceId, id: In(ids), taxLocked: true } });
    if (taxLocked > 0) {
      throw taxLockedConflict(taxLocked);
    }

    // The snapshot the audit keeps, as `findOne` reads a row: undo rebuilds from it.
    const rows = await repo.find({
      where: { workspaceId, id: In(ids) },
      relations: { category: true, branch: true, wallet: true, payee: true },
      order: { id: 'ASC' },
    });
    const removed = rows.map(row => ({ row, links: linksOf(row, closure) }));

    await deleteAndDetach(manager, workspaceId, targets);
    await recountStatementTotals(
      manager,
      workspaceId,
      targets.map(row => row.statementId),
    );
    return removed;
  }

  private async resolveActorName(userId: string): Promise<string> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: { name: true, email: true },
    });
    return user?.name || user?.email || 'User';
  }
}
