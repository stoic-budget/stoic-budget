import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { SubscriptionDetectionService } from './subscription-detection.service';

@Injectable()
export class SubscriptionEventsListener {
  private readonly logger = new Logger(SubscriptionEventsListener.name);

  constructor(private readonly detectionService: SubscriptionDetectionService) {}

  // A pending row the bank booked counts from now on, like a freshly imported one.
  @OnEvent('import.committed')
  @OnEvent('transactions.posted')
  async handleImportCommitted(payload: { workspaceId: string }): Promise<void> {
    this.logger.log(`Running subscription detection for workspace ${payload.workspaceId}`);
    await this.detectionService.runDetection(payload.workspaceId);
  }
}
