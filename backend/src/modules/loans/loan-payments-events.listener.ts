import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import type { ImportCommittedEvent } from '../notifications/events/notification-events';
import { LoanPaymentSplitService } from './loan-payment-split.service';

/** A statement just brought rows in: payments into a loan that asks for it are split. */
@Injectable()
export class LoanPaymentsEventsListener {
  private readonly logger = new Logger(LoanPaymentsEventsListener.name);

  constructor(private readonly split: LoanPaymentSplitService) {}

  @OnEvent('import.committed')
  async handleImportCommitted(event: ImportCommittedEvent): Promise<void> {
    try {
      await this.split.autoSplit(event.workspaceId, event.transactionIds ?? []);
    } catch (error) {
      this.logger.error(
        `Failed to split imported loan payments in ${event.workspaceId}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }
}
