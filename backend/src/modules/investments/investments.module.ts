import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BalanceAccount } from '../../entities/balance-account.entity';
import { InvestmentHolding } from '../../entities/investment-holding.entity';
import { InvestmentTrade } from '../../entities/investment-trade.entity';
import { MetalSale } from '../../entities/metal-sale.entity';
import { Receipt } from '../../entities/receipt.entity';
import { Transaction } from '../../entities/transaction.entity';
import { Workspace } from '../../entities/workspace.entity';
import { WorkspaceMember } from '../../entities/workspace-member.entity';
import { WorkspaceServiceSettings } from '../../entities/workspace-service-settings.entity';
import { BalanceModule } from '../balance/balance.module';
import { CryptoModule } from '../crypto/crypto.module';
import { ExchangeRatesModule } from '../exchange-rates/exchange-rates.module';
import { HoldingClassificationService } from './holding-classification.service';
import { InvestmentFlowsService } from './investment-flows.service';
import { InvestmentReturnsService } from './investment-returns.service';
import { InvestmentSettingsService } from './investment-settings.service';
import { InvestmentTradesController } from './investment-trades.controller';
import { InvestmentTradesService } from './investment-trades.service';
import { InvestmentsController } from './investments.controller';
import { InvestmentsScheduler } from './investments.scheduler';
import { InvestmentsService } from './investments.service';
import { MetalsController } from './metals.controller';
import { MetalsService } from './metals.service';
import { SecuritySectorService } from './security-sector.service';
import { StockPriceService } from './stock-price.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      BalanceAccount,
      InvestmentHolding,
      InvestmentTrade,
      MetalSale,
      Receipt,
      Transaction,
      Workspace,
      WorkspaceMember,
      WorkspaceServiceSettings,
    ]),
    BalanceModule,
    CryptoModule,
    ExchangeRatesModule,
  ],
  controllers: [InvestmentsController, InvestmentTradesController, MetalsController],
  providers: [
    HoldingClassificationService,
    InvestmentFlowsService,
    InvestmentReturnsService,
    InvestmentSettingsService,
    InvestmentTradesService,
    InvestmentsService,
    InvestmentsScheduler,
    MetalsService,
    SecuritySectorService,
    StockPriceService,
  ],
  exports: [InvestmentFlowsService, InvestmentTradesService, InvestmentsService, MetalsService],
})
export class InvestmentsModule {}
