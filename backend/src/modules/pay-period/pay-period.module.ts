import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Transaction } from '../../entities/transaction.entity';
import { Workspace } from '../../entities/workspace.entity';
import { ReferenceDataModule } from '../reference-data/reference-data.module';
import { PayPeriodController } from './pay-period.controller';
import { PayPeriodService } from './pay-period.service';

/**
 * The workspace's own month (`settings.monthStart`). Imported by the feature
 * modules that sum "a month" — budgets, dashboard, insights, subscriptions,
 * goals, reports — rather than by the app module.
 */
@Module({
  imports: [TypeOrmModule.forFeature([Workspace, Transaction]), ReferenceDataModule],
  controllers: [PayPeriodController],
  providers: [PayPeriodService],
  exports: [PayPeriodService],
})
export class PayPeriodModule {}
