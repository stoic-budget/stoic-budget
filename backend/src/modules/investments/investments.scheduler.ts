import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { notInVersionWorkspace } from '../../common/workspaces/version-workspaces';
import { InvestmentHolding } from '../../entities/investment-holding.entity';
import { InvestmentsService } from './investments.service';
import { MetalsService } from './metals.service';
import { SecurityPricesService } from './security-prices.service';

/**
 * Prices used to move only when someone opened the page and pressed refresh,
 * so an account's value — and with it the net worth line — stood still for as
 * long as nobody looked. Once a day is enough for daily closes, which is all
 * the free sources quote anyway.
 */
@Injectable()
export class InvestmentsScheduler {
  private readonly logger = new Logger(InvestmentsScheduler.name);

  constructor(
    private readonly investmentsService: InvestmentsService,
    private readonly securityPrices: SecurityPricesService,
    private readonly metalsService: MetalsService,
    @InjectRepository(InvestmentHolding)
    private readonly holdingRepository: Repository<InvestmentHolding>,
  ) {}

  /**
   * Yesterday's closes of every held symbol, before the holdings are repriced:
   * once per symbol for all workspaces, since a close is the same for everyone.
   */
  @Cron(CronExpression.EVERY_DAY_AT_5AM)
  async recordDailyCloses(): Promise<void> {
    try {
      const { fetched, failed } = await this.securityPrices.recordDailyCloses();
      this.logger.log(`Daily closes: ${fetched} symbols fetched, ${failed} failed`);
    } catch (error) {
      this.logger.error('Daily closes failed', error instanceof Error ? error.stack : undefined);
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_6AM)
  async refreshAllPrices(): Promise<void> {
    const workspaceIds = await this.investmentsService.workspacesWithPricedHoldings();
    for (const workspaceId of workspaceIds) {
      try {
        // No user is behind this, so the snapshot is written as the system.
        const { updated } = await this.investmentsService.refreshPrices(null, workspaceId);
        if (updated > 0) {
          this.logger.log(`Repriced ${updated} holdings in workspace ${workspaceId}`);
        }
      } catch (error) {
        // One unreachable quote source must not stop the other workspaces.
        this.logger.error(
          `Price refresh failed for workspace ${workspaceId}`,
          error instanceof Error ? error.stack : undefined,
        );
      }
    }
  }

  /**
   * Precious metals too (#696): their spot moved only when someone pressed
   * refresh, so gold in net worth stood at the price of the last press.
   */
  @Cron(CronExpression.EVERY_DAY_AT_6AM)
  async refreshMetalPrices(): Promise<void> {
    const rows = await this.holdingRepository
      .createQueryBuilder('holding')
      .select('DISTINCT holding.workspaceId', 'workspaceId')
      .where('holding.metal IS NOT NULL')
      .andWhere(notInVersionWorkspace('holding.workspaceId'))
      .getRawMany<{ workspaceId: string }>();
    for (const { workspaceId } of rows) {
      try {
        await this.metalsService.refreshPrices(null, workspaceId);
      } catch (error) {
        this.logger.error(
          `Metal price refresh failed for workspace ${workspaceId}`,
          error instanceof Error ? error.stack : undefined,
        );
      }
    }
  }
}
