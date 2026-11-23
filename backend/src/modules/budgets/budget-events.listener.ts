import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import type { TransactionCreatedEvent } from '../notifications/events/notification-events';
import { BudgetsService } from './budgets.service';

interface ImportCommittedEvent {
  workspaceId: string;
  actorId?: string;
  actorName?: string;
}

@Injectable()
export class BudgetEventsListener {
  private readonly logger = new Logger(BudgetEventsListener.name);

  constructor(private readonly budgetsService: BudgetsService) {}

  // Rows that start counting — approved in Review, or booked by the bank — can push a budget over.
  @OnEvent('import.committed')
  @OnEvent('transactions.posted')
  async handleImportCommitted(event: ImportCommittedEvent): Promise<void> {
    try {
      await this.budgetsService.checkBudgetAlerts(event.workspaceId);
    } catch (error) {
      this.logger.error(
        `Failed to check budget alerts for workspace ${event.workspaceId}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  /**
   * A single new row (a manual expense, a scan, a payment) can push a budget
   * over too; until now only imports were checked.
   */
  @OnEvent('transaction.created')
  async handleTransactionCreated(event: TransactionCreatedEvent): Promise<void> {
    try {
      await this.budgetsService.checkBudgetAlerts(event.workspaceId, event.categoryId ?? undefined);
    } catch (error) {
      this.logger.error(
        `Failed to check budget alerts for workspace ${event.workspaceId}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }
}
