import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Cron } from '@nestjs/schedule';
import { LoanRemindersService } from './loan-reminders.service';

/**
 * Every morning, before the bills' own job (08:00) sends the day's reminders,
 * each loan's payment bills are brought in step with its schedule and settled
 * by what reached the account. A statement or a bank sync bringing rows in
 * during the day settles them at once.
 */
@Injectable()
export class LoanRemindersListener {
  private readonly logger = new Logger(LoanRemindersListener.name);

  constructor(private readonly reminders: LoanRemindersService) {}

  @Cron('30 7 * * *')
  async daily(): Promise<void> {
    try {
      await this.reminders.syncAll();
    } catch (error) {
      this.logger.error(
        'Failed to bring loan payment bills in step',
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  @OnEvent('payable.paid')
  async billPaid(event: { workspaceId: string; payableId: string }): Promise<void> {
    try {
      await this.reminders.afterPaid(event.workspaceId, event.payableId);
    } catch (error) {
      this.logger.error(
        `Failed to bring the next loan bill after ${event.payableId} in step`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  @OnEvent('data.deleted')
  async rowsDeleted(event: { workspaceId?: string; entityType?: string }): Promise<void> {
    if (!(event.workspaceId && event.entityType === 'transaction')) return;
    try {
      await this.reminders.reopenDeleted(event.workspaceId);
    } catch (error) {
      this.logger.error(
        `Failed to reopen loan bills whose payment was deleted in ${event.workspaceId}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  @OnEvent('import.committed')
  @OnEvent('transactions.posted')
  async rowsCameIn(event: { workspaceId?: string }): Promise<void> {
    if (!event.workspaceId) return;
    try {
      await this.reminders.settleWorkspace(event.workspaceId);
    } catch (error) {
      this.logger.error(
        `Failed to settle loan payment bills in ${event.workspaceId}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }
}
