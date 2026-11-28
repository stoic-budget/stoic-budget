import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectDataSource } from '@nestjs/typeorm';
import type {
  DataSource,
  EntitySubscriberInterface,
  QueryRunner,
  TransactionCommitEvent,
  TransactionRollbackEvent,
  UpdateEvent,
} from 'typeorm';
import { Transaction } from '../../entities/transaction.entity';
import type { TransactionsPostedEvent } from '../notifications/events/notification-events';
import { TRANSACTIONS_MONEY_CHANGED } from '../receipts/helpers/booked-row';
import { GoalTransactionLinkService } from './goal-transaction-link.service';

/** What a goal contribution is computed from: a change to any of them changes it. */
const MONEY_COLUMNS = new Set([
  'amount',
  'debit',
  'credit',
  'currency',
  'transactionType',
  'transactionDate',
]);

/**
 * A row counted toward a goal and then edited on any path keeps its
 * contribution in step (#609): the drawer linked it again by hand, the
 * statement page and bulk edits did not. Runs once the edit commits, and a
 * failure (no exchange rate) is logged, never fails the edit.
 */
@Injectable()
export class GoalContributionFollowSubscriber implements EntitySubscriberInterface<Transaction> {
  private readonly logger = new Logger(GoalContributionFollowSubscriber.name);
  private readonly queued = new WeakMap<QueryRunner, Array<() => void>>();

  constructor(
    @InjectDataSource() dataSource: DataSource,
    private readonly links: GoalTransactionLinkService,
  ) {
    dataSource.subscribers.push(this);
  }

  listenTo() {
    return Transaction;
  }

  afterUpdate(event: UpdateEvent<Transaction>): void {
    const row = (event.entity ?? event.databaseEntity) as Transaction | undefined;
    const changed = event.updatedColumns.some(column => MONEY_COLUMNS.has(column.propertyName));
    if (!(row?.id && row.workspaceId && changed)) return;
    const { id, workspaceId } = row;
    const task = () =>
      void this.links
        .refresh(workspaceId, id)
        .catch(error =>
          this.logger.warn(
            `Goal contribution of ${id} not refreshed: ${error instanceof Error ? error.message : error}`,
          ),
        );
    const runner = event.queryRunner;
    if (runner?.isTransactionActive) {
      this.queued.set(runner, [...(this.queued.get(runner) ?? []), task]);
    } else {
      task();
    }
  }

  /**
   * Rows whose money changed through `update()`, which reaches no subscriber:
   * a pending bank row posted at its final amount, a receipt's edit synced to
   * the row it booked.
   */
  @OnEvent('transactions.posted')
  @OnEvent(TRANSACTIONS_MONEY_CHANGED)
  async onMoneyChanged(event: TransactionsPostedEvent): Promise<void> {
    for (const id of event.transactionIds) {
      await this.links
        .refresh(event.workspaceId, id)
        .catch(error =>
          this.logger.warn(`Goal contribution of ${id} not refreshed: ${String(error)}`),
        );
    }
  }

  afterTransactionCommit(event: TransactionCommitEvent): void {
    const tasks = this.queued.get(event.queryRunner);
    this.queued.delete(event.queryRunner);
    for (const task of tasks ?? []) task();
  }

  afterTransactionRollback(event: TransactionRollbackEvent): void {
    this.queued.delete(event.queryRunner);
  }
}
