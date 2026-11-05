import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { demoGuestsEnabled } from './demo-guests.config';
import { DemoGuestsService } from './demo-guests.service';

@Injectable()
export class DemoGuestsScheduler {
  private readonly logger = new Logger(DemoGuestsScheduler.name);

  constructor(private readonly demoGuestsService: DemoGuestsService) {}

  @Cron(CronExpression.EVERY_HOUR)
  async sweep(): Promise<void> {
    if (!demoGuestsEnabled()) {
      return;
    }
    try {
      await this.demoGuestsService.removeExpired();
    } catch (error) {
      this.logger.error(
        'Removing expired demo guests failed',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
