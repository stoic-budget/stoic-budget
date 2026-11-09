import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Invoice } from '../../entities/invoice.entity';
import { Payable } from '../../entities/payable.entity';
import { Transaction } from '../../entities/transaction.entity';
import { Workspace } from '../../entities/workspace.entity';
import { DashboardModule } from '../dashboard/dashboard.module';
import { ExchangeRatesModule } from '../exchange-rates/exchange-rates.module';
import { GoalsModule } from '../goals/goals.module';
import { PayPeriodModule } from '../pay-period/pay-period.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { TaxModule } from '../tax/tax.module';
import { ForecastController } from './forecast.controller';
import { ForecastService } from './forecast.service';
import { PaycheckPlannerService } from './paycheck-planner.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Transaction, Invoice, Payable, Workspace]),
    DashboardModule,
    ExchangeRatesModule,
    GoalsModule,
    PayPeriodModule,
    SubscriptionsModule,
    TaxModule,
  ],
  controllers: [ForecastController],
  providers: [ForecastService, PaycheckPlannerService],
  exports: [ForecastService],
})
export class ForecastModule {}
