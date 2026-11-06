import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IdempotencyService } from '../../common/services/idempotency.service';
import { Category } from '../../entities/category.entity';
import { IdempotencyKey } from '../../entities/idempotency-key.entity';
import { Payable } from '../../entities/payable.entity';
import { PayablePayment } from '../../entities/payable-payment.entity';
import { Statement } from '../../entities/statement.entity';
import { Tag } from '../../entities/tag.entity';
import { Transaction } from '../../entities/transaction.entity';
import { Wallet } from '../../entities/wallet.entity';
import { Workspace } from '../../entities/workspace.entity';
import { AuditModule } from '../audit/audit.module';
import { ExchangeRatesModule } from '../exchange-rates/exchange-rates.module';
import { ItemImagesModule } from '../item-images/item-images.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { WorkspaceCurrencyModule } from '../workspaces/workspace-currency.module';
import { PayablesController } from './payables.controller';
import { PayablesScheduler } from './payables.scheduler';
import { PayablesService } from './payables.service';
import { PayablesEventsListener } from './payables-events.listener';
import { PayablesExportService } from './payables-export.service';
import { UnbookedPaymentsService } from './unbooked-payments.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Payable,
      PayablePayment,
      Transaction,
      Statement,
      Workspace,
      Wallet,
      Category,
      Tag,
      IdempotencyKey,
    ]),
    AuditModule,
    ExchangeRatesModule,
    // Pictures of what a bill or its payment was for; app.module is at its size limit.
    ItemImagesModule,
    NotificationsModule,
    WorkspaceCurrencyModule,
  ],
  controllers: [PayablesController],
  providers: [
    PayablesService,
    IdempotencyService,
    PayablesExportService,
    PayablesScheduler,
    UnbookedPaymentsService,
    PayablesEventsListener,
  ],
  exports: [PayablesService],
})
export class PayablesModule {}
