import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import type { ImportCommittedEvent } from '../notifications/events/notification-events';
import { LoanInterestCarryService } from './loan-interest-carry.service';
import { LoanPaymentSplitService } from './loan-payment-split.service';

/**
 * A statement just brought rows in: a split it was read again under moves to
 * the payment's new version, then payments into a loan that asks for it are
 * split.
 */
@Injectable()
export class LoanPaymentsEventsListener {
  private readonly logger = new Logger(LoanPaymentsEventsListener.name);

  constructor(
    private readonly split: LoanPaymentSplitService,
    private readonly carry: LoanInterestCarryService,
  ) {}

  @OnEvent('import.committed')
  async handleImportCommitted(event: ImportCommittedEvent): Promise<void> {
    try {
      if (event.statementId) {
        await this.carry.reattach(event.workspaceId, event.statementId);
      }
      await this.split.autoSplit(event.workspaceId, event.transactionIds ?? []);
    } catch (error) {
      this.logger.error(
        `Failed to split imported loan payments in ${event.workspaceId}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }
}
