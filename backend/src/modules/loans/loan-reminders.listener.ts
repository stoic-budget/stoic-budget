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
