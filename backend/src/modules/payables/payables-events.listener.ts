import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import type {
  ImportCommittedEvent,
  PayablePaidEvent,
} from '../notifications/events/notification-events';
import { PayableRecurrenceService } from './payable-recurrence.service';
import { UnbookedPaymentsService } from './unbooked-payments.service';

/**
 * A statement just brought rows in: a bill or receivable marked paid without
 * a wallet or a bank row may have its money among them, and is linked to it.
 * A repeating bill just got paid: its next occurrence is made now.
 */
@Injectable()
export class PayablesEventsListener {
  private readonly logger = new Logger(PayablesEventsListener.name);

  constructor(
    private readonly unbookedPayments: UnbookedPaymentsService,
    private readonly recurrence: PayableRecurrenceService,
  ) {}

  /** Sent after the payment's transaction commits; idempotent, so a repeat makes nothing more. */
  @OnEvent('payable.paid')
  async handlePayablePaid(event: PayablePaidEvent): Promise<void> {
    try {
      const created = await this.recurrence.ensureSeriesFor(event.workspaceId, event.payableId);
      if (created > 0) {
        this.logger.log(`Made ${created} next occurrence(s) of bill ${event.payableId}`);
      }
    } catch (error) {
      this.logger.error(
        `Failed to make the next occurrence of bill ${event.payableId}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  @OnEvent('import.committed')
  async handleImportCommitted(event: ImportCommittedEvent): Promise<void> {
    try {
      const linked = await this.unbookedPayments.linkUnbooked(event.workspaceId);
      if (linked > 0) {
        this.logger.log(`Linked ${linked} payment(s) to imported rows in ${event.workspaceId}`);
      }
    } catch (error) {
      this.logger.error(
        `Failed to link payments to imported rows in ${event.workspaceId}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }
}
