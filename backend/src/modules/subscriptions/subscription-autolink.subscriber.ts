import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectDataSource } from '@nestjs/typeorm';
import type {
  DataSource,
  EntitySubscriberInterface,
  InsertEvent,
  QueryRunner,
  TransactionCommitEvent,
  TransactionRollbackEvent,
  TransactionStartEvent,
} from 'typeorm';
import { Transaction, TransactionType } from '../../entities/transaction.entity';
import { AuditService } from '../audit/audit.service';
import type { CreateAuditEventDto } from '../audit/interfaces/audit-event.interface';
import type { TransactionsPostedEvent } from '../notifications/events/notification-events';
import { SubscriptionsService } from './subscriptions.service';

const SAVEPOINT = 'sub_autolink';
/**
 * Audit events of links made in a database transaction, one list per nesting
 * level: written once the outermost transaction commits, dropped with the
 * level that rolls back.
 */
const PENDING_AUDIT = 'subscriptionAutoLinkAudit';

/**
 * A new expense row of a payee that a person linked to a subscription before
 * becomes a payment of that subscription, in the same database transaction as
 * the insert: a rolled-back import takes its payments with it. Only `save()`
 * reaches a subscriber. Never fails the insert: an error is logged and the
 * work undone to a savepoint, so the surrounding transaction stays usable.
 */
@Injectable()
export class SubscriptionAutoLinkSubscriber implements EntitySubscriberInterface<Transaction> {
  private readonly logger = new Logger(SubscriptionAutoLinkSubscriber.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly subscriptionsService: SubscriptionsService,
    private readonly auditService: AuditService,
  ) {
    dataSource.subscribers.push(this);
  }

  listenTo() {
    return Transaction;
  }

  async afterInsert(event: InsertEvent<Transaction>): Promise<void> {
    const transaction = event.entity;
    if (!linkable(transaction)) {
      return;
    }
    const inTransaction = event.queryRunner.isTransactionActive;
    try {
      if (inTransaction) {
        await event.manager.query(`SAVEPOINT ${SAVEPOINT}`);
      }
      const audit = await this.subscriptionsService.autoLinkTransaction(event.manager, transaction);
      if (inTransaction) {
        await event.manager.query(`RELEASE SAVEPOINT ${SAVEPOINT}`);
      }
      if (!audit) {
        return;
      }
      const levels = pendingLevels(event.queryRunner);
      if (inTransaction && levels.length) {
        levels[levels.length - 1].push(audit);
      } else {
        await this.writeAudit([audit]);
      }
    } catch (error) {
      if (inTransaction) {
        await event.manager.query(`ROLLBACK TO SAVEPOINT ${SAVEPOINT}`).catch(() => undefined);
      }
      this.logger.warn(
        `Could not auto-link transaction ${transaction.id} in workspace ${transaction.workspaceId}: ${
          error instanceof Error ? error.name : 'unknown error'
        }`,
      );
    }
  }

  /**
   * A pending row the bank booked is updated in place, which no subscriber
   * sees: it becomes a payment here, as an inserted row would have.
   */
  @OnEvent('transactions.posted')
  async linkPosted(event: TransactionsPostedEvent): Promise<void> {
    for (const id of event.transactionIds) {
      try {
        const audit = await this.dataSource.transaction(async manager => {
          const row = await manager.findOne(Transaction, {
            where: { id, workspaceId: event.workspaceId },
          });
          return row && linkable(row)
            ? this.subscriptionsService.autoLinkTransaction(manager, row)
            : null;
        });
        if (audit) await this.writeAudit([audit]);
      } catch (error) {
        this.logger.warn(
          `Could not auto-link posted transaction ${id} in workspace ${event.workspaceId}: ${
            error instanceof Error ? error.name : 'unknown error'
          }`,
        );
      }
    }
  }

  afterTransactionStart(event: TransactionStartEvent): void {
    pendingLevels(event.queryRunner).push([]);
  }

  async afterTransactionCommit(event: TransactionCommitEvent): Promise<void> {
    const levels = pendingLevels(event.queryRunner);
    const level = levels.pop() ?? [];
    if (levels.length) {
      levels[levels.length - 1].push(...level);
    } else if (level.length) {
      await this.writeAudit(level);
    }
  }

  afterTransactionRollback(event: TransactionRollbackEvent): void {
    pendingLevels(event.queryRunner).pop();
  }

  /** The audit trail is a side record: failing to write it must not fail the import. */
  private async writeAudit(events: CreateAuditEventDto[]): Promise<void> {
    for (const audit of events) {
      try {
        await this.auditService.createEvent(audit);
      } catch {
        this.logger.warn(
          `Failed to record auto-link audit event for subscription ${audit.entityId}`,
        );
      }
    }
  }
}

/**
 * An expense of a known payee, with an amount. A pending row may never book:
 * it becomes a payment once posted (`linkPosted`), not before.
 */
function linkable(transaction: Transaction | undefined): transaction is Transaction {
  return Boolean(
    transaction?.id &&
      transaction.workspaceId &&
      transaction.payeeId &&
      !transaction.isPending &&
      transaction.transactionType === TransactionType.EXPENSE &&
      transaction.amount != null,
  );
}

function pendingLevels(queryRunner: QueryRunner): CreateAuditEventDto[][] {
  if (!queryRunner.data[PENDING_AUDIT]) {
    queryRunner.data[PENDING_AUDIT] = [];
  }
  return queryRunner.data[PENDING_AUDIT] as CreateAuditEventDto[][];
}
