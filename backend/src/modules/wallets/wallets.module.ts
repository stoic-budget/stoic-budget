import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Statement } from '../../entities/statement.entity';
import { Transaction } from '../../entities/transaction.entity';
import { Wallet } from '../../entities/wallet.entity';
import { WorkspaceMember } from '../../entities/workspace-member.entity';
import { AuditModule } from '../audit/audit.module';
import { ExchangeRatesModule } from '../exchange-rates/exchange-rates.module';
import { WorkspaceCurrencyModule } from '../workspaces/workspace-currency.module';
import { WalletBalanceCheckController } from './wallet-balance-check.controller';
import { WalletBalanceCheckService } from './wallet-balance-check.service';
import { WalletStatementsService } from './wallet-statements.service';
import { WalletsController } from './wallets.controller';
import { WalletsService } from './wallets.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Wallet, WorkspaceMember, Transaction, Statement]),
    WorkspaceCurrencyModule,
    ExchangeRatesModule,
    AuditModule,
  ],
  controllers: [WalletsController, WalletBalanceCheckController],
  providers: [WalletsService, WalletStatementsService, WalletBalanceCheckService],
  exports: [WalletsService],
})
export class WalletsModule {}
