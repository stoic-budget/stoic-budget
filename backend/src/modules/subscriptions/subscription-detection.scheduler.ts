import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { STANDARD_WORKSPACE } from '../../common/workspaces/version-workspaces';
import { Workspace } from '../../entities/workspace.entity';
import { SubscriptionDetectionService } from './subscription-detection.service';

/**
 * Detection reads approved rows only, and an import runs it before anyone has
 * approved what it brought. Without a pass of its own, a subscription waits for
 * the import after the approval, which can be a month away.
 */
@Injectable()
export class SubscriptionDetectionScheduler {
  private readonly logger = new Logger(SubscriptionDetectionScheduler.name);

  constructor(
    @InjectRepository(Workspace)
    private readonly workspaceRepository: Repository<Workspace>,
    private readonly detectionService: SubscriptionDetectionService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_5AM)
  async detectEverywhere(): Promise<void> {
    const workspaces = await this.workspaceRepository.find({
      where: STANDARD_WORKSPACE,
      select: { id: true },
    });
    for (const { id } of workspaces) {
      try {
        await this.detectionService.runDetection(id);
      } catch (error) {
        // One workspace's failure must not stop the others.
        this.logger.error(
          `Subscription detection failed for workspace ${id}`,
          error instanceof Error ? error.stack : undefined,
        );
      }
    }
  }
}
